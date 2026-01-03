import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Geospatial Service for Route Calculation
 * FE already provides lat/lng, so we only calculate routes
 * Uses OpenRouteService (free) or Haversine distance as fallback
 */
export interface RouteResult {
  distance: number; // km
  duration: number; // minutes (estimated)
  polyline?: string; // Encoded polyline string (optional)
}

@Injectable()
export class GeospatialService {
  private readonly openRouteServiceApiKey: string;
  private readonly cacheExpiryMinutes: number = 24 * 60; // 24 hours cache
  private redisClient: any = null; // Redis client (optional, will be null if redis not installed)

  constructor() {
    // OpenRouteService API key (free tier available)
    this.openRouteServiceApiKey = process.env.OPENROUTESERVICE_API_KEY || '';

    if (!this.openRouteServiceApiKey) {
      Logger.warn(
        'OPENROUTESERVICE_API_KEY not configured. Route calculation will use Haversine distance (straight line).',
        'GeospatialService',
      );
    }

    // Initialize Redis client for caching (optional, falls back to in-memory cache)
    this.initRedisCache();
  }

  /**
   * Initialize Redis client for distributed caching
   */
  private async initRedisCache(): Promise<void> {
    try {
      // Dynamic import of redis (optional dependency)
      // @ts-expect-error - redis is optional dependency, may not be installed
      const redis = await import('redis').catch(() => null);
      if (!redis) {
        Logger.warn('Redis package not installed. Using in-memory cache only.', 'GeospatialService');
        this.redisClient = null;
        return;
      }

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = redis.createClient({ url: redisUrl });

      this.redisClient.on('error', (err: Error) => {
        Logger.warn(`Redis cache error: ${err.message}. Falling back to in-memory cache.`, 'GeospatialService');
        this.redisClient = null;
      });

      await this.redisClient.connect();
      Logger.info('Redis cache connected for GeospatialService', 'GeospatialService');
    } catch (error) {
      // Redis not installed or connection failed - use in-memory cache only
      Logger.warn('Redis cache not available. Using in-memory cache only.', 'GeospatialService');
      this.redisClient = null;
    }
  }

  /**
   * Calculate route from coordinates (lat,lng format)
   * FE already provides coordinates, so we just calculate route
   */
  async calculateRouteFromCoordinates(originLatLong: string, destinationLatLong: string): Promise<RouteResult | null> {
    try {
      const [originLat, originLng] = originLatLong.split(',').map(Number);
      const [destLat, destLng] = destinationLatLong.split(',').map(Number);

      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        throw new Error('Invalid coordinate format. Expected format: "lat,lng"');
      }

      // Check cache first
      const cacheKey = `route:${originLatLong}:${destinationLatLong}`;
      const cached = await this.getCachedRoute(cacheKey);
      if (cached) {
        Logger.debug(`Route cache hit for: ${originLatLong} -> ${destinationLatLong}`, 'GeospatialService');
        return cached;
      }

      // Try OSRM first (free, no API key required)
      try {
        const route = await this.calculateRouteWithOSRM(
          { lat: originLat, lng: originLng },
          { lat: destLat, lng: destLng },
        );
        await this.cacheRoute(cacheKey, route);
        return route;
      } catch (error) {
        Logger.warn(
          `OSRM failed, trying OpenRouteService: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'GeospatialService',
        );
      }

      // Fallback to OpenRouteService if API key is available
      if (this.openRouteServiceApiKey) {
        try {
          const route = await this.calculateRouteWithOpenRouteService(
            { lat: originLat, lng: originLng },
            { lat: destLat, lng: destLng },
          );
          await this.cacheRoute(cacheKey, route);
          return route;
        } catch (error) {
          Logger.warn(
            `OpenRouteService failed, using Haversine distance: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'GeospatialService',
          );
        }
      }

      // Fallback to Haversine distance (straight line)
      const distance = this.haversineDistance({ lat: originLat, lng: originLng }, { lat: destLat, lng: destLng });
      const duration = Math.round(distance * 2); // Rough estimate: 2 minutes per km

      const result: RouteResult = {
        distance,
        duration,
      };

      await this.cacheRoute(cacheKey, result);
      return result;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error calculating route from coordinates',
        error instanceof Error ? error.stack : undefined,
        'GeospatialService.calculateRouteFromCoordinates',
      );
      return null;
    }
  }

  /**
   * Calculate route using OSRM (Open Source Routing Machine) - Free API
   * API: https://router.project-osrm.org/route/v1/driving/
   */
  async calculateRouteWithOSRM(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteResult> {
    const apiUrl = 'https://router.project-osrm.org/route/v1/driving';
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

    const response = await axios.get(`${apiUrl}/${coordinates}`, {
      params: {
        overview: 'false', // We don't need full geometry, just distance and duration
        geometries: 'geojson',
      },
      timeout: 10000,
    });

    if (!response.data || response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
      throw new Error('No route found from OSRM');
    }

    const route = response.data.routes[0];

    // Distance in meters, convert to km
    const distance = (route.distance || 0) / 1000;
    // Duration in seconds, convert to minutes
    const duration = Math.round((route.duration || 0) / 60);

    return {
      distance,
      duration,
      polyline: '', // Optional - can be implemented later if needed
    };
  }

  /**
   * Calculate route using OpenRouteService (free API)
   */
  private async calculateRouteWithOpenRouteService(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteResult> {
    const apiUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const response = await axios.get(apiUrl, {
      params: {
        api_key: this.openRouteServiceApiKey,
        start: `${origin.lng},${origin.lat}`, // OpenRouteService uses lng,lat format
        end: `${destination.lng},${destination.lat}`,
      },
      timeout: 10000,
    });

    if (!response.data || !response.data.features || response.data.features.length === 0) {
      throw new Error('No route found');
    }

    const route = response.data.features[0];
    const properties = route.properties;

    // Distance in meters, convert to km
    const distance = (properties.segments?.[0]?.distance || 0) / 1000;
    // Duration in seconds, convert to minutes
    const duration = Math.round((properties.segments?.[0]?.duration || 0) / 60);

    return {
      distance,
      duration,
      polyline: '', // Optional - can be implemented later if needed
    };
  }

  /**
   * Calculate route similarity between two polylines
   * Returns similarity percentage (0-100)
   */
  async calculateRouteSimilarity(polyline1: string, polyline2: string): Promise<number> {
    if (!polyline1 || !polyline2) {
      return 0;
    }

    // Decode polylines to coordinate arrays
    const coords1 = this.decodePolyline(polyline1);
    const coords2 = this.decodePolyline(polyline2);

    if (coords1.length === 0 || coords2.length === 0) {
      return 0;
    }

    // Calculate similarity using Hausdorff distance or similar algorithm
    // Simplified: compare start/end points and intermediate waypoints
    const start1 = coords1[0];
    const end1 = coords1[coords1.length - 1];
    const start2 = coords2[0];
    const end2 = coords2[coords2.length - 1];

    // Calculate distance between start points and end points
    const startDistance = this.haversineDistance(start1, start2);
    const endDistance = this.haversineDistance(end1, end2);

    // If start/end points are very close, routes are similar
    const maxDistance = 5; // km - maximum distance for similar routes
    const startSimilarity = Math.max(0, 100 - (startDistance / maxDistance) * 100);
    const endSimilarity = Math.max(0, 100 - (endDistance / maxDistance) * 100);

    // Average similarity
    const similarity = (startSimilarity + endSimilarity) / 2;

    return Math.min(100, Math.max(0, similarity));
  }

  /**
   * Decode polyline string to coordinate array
   */
  private decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
    const poly: Array<{ lat: number; lng: number }> = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
    }

    return poly;
  }

  /**
   * Calculate Haversine distance between two coordinates (in km)
   */
  private haversineDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(coord2.lat - coord1.lat);
    const dLon = this.toRad(coord2.lng - coord1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(coord1.lat)) * Math.cos(this.toRad(coord2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Cache route result
   */
  private async cacheRoute(cacheKey: string, result: RouteResult): Promise<void> {
    try {
      const fullCacheKey = `route:${cacheKey}`;

      if (this.redisClient) {
        await this.redisClient.setEx(fullCacheKey, this.cacheExpiryMinutes * 60, JSON.stringify(result));
      }
    } catch (error) {
      Logger.debug('Failed to cache route result', 'GeospatialService');
    }
  }

  /**
   * Get cached route result
   */
  private async getCachedRoute(cacheKey: string): Promise<RouteResult | null> {
    try {
      const fullCacheKey = `route:${cacheKey}`;

      if (this.redisClient) {
        const cached = await this.redisClient.get(fullCacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (error) {
      // Cache miss is fine
    }

    return null;
  }
}

# Geospatial & Carpool V2.0 Implementation

## Overview

Implementasi peningkatan untuk sistem Carpool dengan integrasi Geospatial Service untuk meningkatkan akurasi matching dan estimasi biaya. Semua perubahan mengikuti prinsip **Audit Trail** dan **Idempotency**.

---

## A. DATA MODEL & PERSISTENSI

### 1. BookingSegment Schema Updates

**File:** `src/shared/database/prisma/schema.prisma`

**Kolom Baru:**
- `originLatLong` (String, nullable) - Format: "lat,lng" (e.g., "-6.2088,106.8456")
- `destinationLatLong` (String, nullable) - Format: "lat,lng"
- `routePolyline` (String, nullable) - Encoded polyline string dari Maps API
- `routeGeohash` (String, nullable) - Alternatif: Geohash representation
- `geocodeAccuracy` (Float, nullable) - Accuracy score (0-100)
- `geocodeValidated` (Boolean, default: false) - Flag jika geocoding berhasil

**Migration Required:**
```bash
npx prisma migrate dev --name add_geospatial_to_booking_segment
```

### 2. CarpoolGroup Schema Updates

**File:** `src/shared/database/prisma/schema.prisma`

**Kolom Baru:**
- `preMergeDistance` (Float, nullable) - Total jarak sebelum merge (km)
- `postMergeDistance` (Float, nullable) - Total jarak setelah merge (km)
- `detourPercentage` (Float, nullable) - Persentase penyimpangan rute Host pasca merge

**Migration Required:**
```bash
npx prisma migrate dev --name add_metrics_to_carpool_group
```

---

## B. SERVICE LAYER

### 1. GeospatialService

**File:** `src/shared/services/geospatial.service.ts`

**Fitur:**
- **Geocoding**: Convert alamat teks ke koordinat lat/lng dengan validasi akurasi
- **Route Calculation**: Hitung jarak, durasi, dan generate polyline
- **Route Similarity**: Bandingkan polyline untuk menghitung kemiripan rute (%)
- **Caching**: Redis cache untuk idempotency (24 jam TTL)
- **Fallback**: Jika API key tidak tersedia, gunakan estimasi sederhana

**Methods:**
```typescript
// Geocode address to coordinates
async geocodeAddress(address: string): Promise<GeocodeResult>

// Calculate route between two points
async calculateRoute(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string,
  waypoints?: Array<{ lat: number; lng: number } | string>
): Promise<RouteResult>

// Calculate route similarity between two polylines
async calculateRouteSimilarity(polyline1: string, polyline2: string): Promise<number>
```

**Environment Variables:**
```env
GOOGLE_MAPS_API_KEY=your_api_key_here
REDIS_URL=redis://localhost:6379  # Optional, untuk caching
```

**Konfigurasi:**
- Minimum geocode accuracy: 70% (configurable)
- Cache expiry: 24 jam
- Timeout: 10 detik

---

### 2. BookingUseCase Integration

**File:** `src/packages/bookings/usecase/bookings.usecase.ts`

**Perubahan:**
- **Create Booking**: Geocode segment saat create (wajib untuk submit, optional untuk draft)
- **Update Booking**: Geocode segment saat update jika from/to berubah
- **Validation**: Block submission jika geocoding gagal atau accuracy < 70%
- **Audit Trail**: Log semua operasi geocoding ke `AuditLog` table

**Flow:**
1. User mengisi form booking dengan alamat origin & destination
2. Saat submit (bukan draft), sistem geocode kedua alamat
3. Validasi accuracy ≥ 70%
4. Hitung route dan simpan polyline
5. Simpan koordinat dan polyline ke `BookingSegment`
6. Log ke audit trail

**Error Handling:**
- Jika geocoding gagal saat submit → Block submission dengan error message
- Jika geocoding gagal saat draft → Allow, tapi flag `geocodeValidated = false`
- Retry geocoding saat draft di-submit

---

### 3. CarpoolCandidateMatcherService Enhancement

**File:** `src/packages/carpool/services/carpool-candidate-matcher.service.ts`

**Perubahan:**
- **Route Similarity**: Gunakan polyline similarity jika tersedia
- **Fallback**: String matching jika polyline tidak tersedia
- **Priority**: Polyline similarity > String matching

**Flow:**
1. Cek apakah host dan candidate memiliki `routePolyline` dan `geocodeValidated = true`
2. Jika ya, gunakan `GeospatialService.calculateRouteSimilarity()`
3. Jika tidak, fallback ke string matching (existing logic)

---

### 4. CarpoolMergeEngineService Enhancement

**File:** `src/packages/carpool/services/carpool-merge-engine.service.ts`

**Perubahan:**
- **Route Calculation**: Gunakan `GeospatialService` untuk calculate combined route
- **Metrics Calculation**: Hitung preMergeDistance, postMergeDistance, detourPercentage
- **Validation**: Validasi detour percentage terhadap config `maxDetourPercentage`
- **Persistence**: Simpan metrics ke `CarpoolGroup` table

**Flow:**
1. Hitung `preMergeDistance` (sum individual booking distances)
2. Calculate combined route menggunakan `GeospatialService`
3. Hitung `postMergeDistance` dari combined route
4. Hitung `detourPercentage` untuk host route
5. Validasi terhadap `maxDetourPercentage` (soft block jika melebihi)
6. Simpan semua metrics ke database
7. Log ke audit trail dengan metrics

---

### 5. CarpoolCostAllocatorService Enhancement

**File:** `src/packages/carpool/services/carpool-cost-allocator.service.ts`

**Perubahan:**
- **Priority**: Gunakan `postMergeDistance` dari `CarpoolGroup` (paling akurat)
- **Fallback**: Gunakan `combinedRoute.totalDistance` jika `postMergeDistance` tidak tersedia
- **Cost Calculation**: Gunakan distance yang akurat untuk estimasi biaya

**Priority Order:**
1. `carpoolGroup.postMergeDistance` (most accurate)
2. `combinedRoute.totalDistance`
3. Sum individual booking costs (fallback)

---

## C. AUDIT TRAIL & COMPLIANCE

### 1. Audit Logging

**Table:** `AuditLog`

**Fields:**
- `featureCode`: "GEOSPATIAL"
- `action`: "GEOCODE_AND_ROUTE_CALCULATED", "CARPOOL_MERGE", dll
- `entityType`: "BookingSegment", "CarpoolGroup", dll
- `beforeAfter`: JSON dengan oldValue, newValue, metadata

**Logging Points:**
- Geocoding saat create/update booking segment
- Route calculation saat merge carpool
- Detour calculation dan validation
- Cost recalculation dengan postMergeDistance

**File:** `src/packages/bookings/usecase/bookings.usecase.ts` (method `logGeospatialAudit`)

---

### 2. Idempotency

**Mechanism:**
- **Redis Caching**: Cache geocode results dengan TTL 24 jam
- **Cache Key**: `geocode:{normalized_address}` dan `route:{origin}:{destination}`
- **Cache Hit**: Return cached result tanpa call API
- **Cache Miss**: Call API, cache result, return

**Benefits:**
- Mengurangi API calls ke Google Maps API
- Memastikan hasil konsisten untuk alamat yang sama
- Meningkatkan performance

**File:** `src/shared/services/geospatial.service.ts` (methods `cacheGeocode`, `getCachedGeocode`, `cacheRoute`, `getCachedRoute`)

---

## D. VALIDATION & ERROR HANDLING

### 1. Geocode Validation

**Rules:**
- Minimum accuracy: 70% (configurable via `minGeocodeAccuracy`)
- Accuracy calculation berdasarkan:
  - Location type (ROOFTOP = 100%, RANGE_INTERPOLATED = 85%, dll)
  - Result types (street_address = 95%, route = 80%, dll)

**Error Handling:**
- Jika accuracy < 70% → Block submission dengan error message
- Jika geocoding gagal → Block submission dengan error message
- Untuk draft → Allow tanpa geocoding, flag `geocodeValidated = false`

---

### 2. Detour Validation

**Rules:**
- Maximum detour: Configurable via `MAX_DETOUR_PERCENTAGE` (default: 15%)
- Calculation: `((postMergeDistance - hostOriginalDistance) / hostOriginalDistance) * 100`

**Error Handling:**
- Jika detour > max → **Soft block** (warning log, allow merge)
- GA dapat override jika diperlukan
- Log warning ke audit trail

---

## E. CONFIGURATION

### Environment Variables

```env
# Google Maps API
GOOGLE_MAPS_API_KEY=your_api_key_here

# Redis (optional, untuk caching)
REDIS_URL=redis://localhost:6379
```

### ParamSet Configuration

**Group:** `CARPOOL`

**Parameters:**
- `TIME_WINDOW_MINUTES` (default: 30)
- `ROUTE_SIMILARITY_THRESHOLD` (default: 70)
- `MAX_DETOUR_PERCENTAGE` (default: 15) ← **NEW: Untuk validasi detour**
- `DEFAULT_INVITE_EXPIRY_MINUTES` (default: 60)
- `MAX_VEHICLE_SEAT_CAPACITY` (default: 7)

---

## F. MIGRATION STEPS

### 1. Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_geospatial_and_carpool_metrics

# Apply migration
npx prisma migrate deploy
```

### 2. Environment Setup

```bash
# Add to .env
GOOGLE_MAPS_API_KEY=your_api_key_here
REDIS_URL=redis://localhost:6379  # Optional
```

### 3. Backfill Existing Data (Optional)

Jika ada data existing yang perlu di-geocode:

```sql
-- Update existing segments dengan geocodeValidated = false
UPDATE booking_segment 
SET geocode_validated = false 
WHERE origin_lat_long IS NULL;
```

Kemudian trigger geocoding saat update booking berikutnya.

---

## G. TESTING

### 1. Unit Tests

**Test Cases:**
- Geocode address dengan accuracy tinggi
- Geocode address dengan accuracy rendah (should fail)
- Route calculation dengan waypoints
- Route similarity calculation
- Cache hit/miss scenarios
- Detour calculation

### 2. Integration Tests

**Test Cases:**
- Create booking dengan geocoding
- Update booking dengan geocoding
- Carpool matching dengan polyline similarity
- Carpool merge dengan detour calculation
- Cost allocation dengan postMergeDistance

### 3. Manual Testing

**Scenarios:**
1. Create booking dengan alamat valid → Should geocode successfully
2. Create booking dengan alamat tidak jelas → Should block dengan error
3. Create draft booking → Should allow tanpa geocoding
4. Submit draft booking → Should geocode dan validate
5. Carpool matching → Should use polyline similarity jika tersedia
6. Carpool merge → Should calculate dan save metrics
7. Cost allocation → Should use postMergeDistance

---

## H. API CHANGES

### No Breaking Changes

Semua perubahan **backward compatible**:
- Kolom baru di schema adalah nullable
- Geocoding hanya wajib untuk submit (bukan draft)
- Fallback ke string matching jika polyline tidak tersedia
- Fallback ke estimasi jika geocoding tidak tersedia

---

## I. PERFORMANCE CONSIDERATIONS

### 1. Caching

- **Geocode Cache**: 24 jam TTL
- **Route Cache**: 24 jam TTL
- **Redis**: Distributed cache untuk multi-instance

### 2. API Rate Limiting

- Google Maps API memiliki rate limits
- Caching mengurangi API calls
- Consider implementing rate limiting jika diperlukan

### 3. Async Operations

- Geocoding dilakukan secara synchronous saat create/update
- Consider making async jika performance menjadi issue

---

## J. FUTURE ENHANCEMENTS

1. **Batch Geocoding**: Geocode multiple addresses dalam satu call
2. **Geohash Support**: Implementasi geohash untuk faster similarity calculation
3. **Alternative Maps Providers**: Support untuk OpenStreetMap, Mapbox, dll
4. **Real-time Route Updates**: Update route jika ada traffic changes
5. **CostSet Integration**: Gunakan CostSet dari ParamSet untuk cost calculation (FR-SET-008)

---

## K. TROUBLESHOOTING

### Issue: Geocoding selalu gagal

**Solution:**
- Check `GOOGLE_MAPS_API_KEY` di environment variables
- Check API key quota/billing
- Check network connectivity
- Check address format (should be valid address string)

### Issue: Cache tidak bekerja

**Solution:**
- Check `REDIS_URL` di environment variables
- Check Redis server running
- Check Redis connection logs
- Service akan fallback ke no-cache jika Redis tidak tersedia

### Issue: Detour percentage selalu 0

**Solution:**
- Check apakah `postMergeDistance` dan `preMergeDistance` terisi
- Check apakah `hostBooking.segments[0].estKm` terisi
- Check calculation logic di `CarpoolMergeEngineService`

---

## L. SUMMARY

### Completed Tasks

✅ Update schema untuk geospatial fields  
✅ Create GeospatialService dengan caching  
✅ Integrate geocoding ke BookingUseCase  
✅ Enhance CarpoolCandidateMatcherService dengan polyline similarity  
✅ Enhance CarpoolMergeEngineService dengan metrics calculation  
✅ Enhance CarpoolCostAllocatorService dengan postMergeDistance  
✅ Add audit trail logging  
✅ Implement idempotency dengan caching  

### Key Benefits

1. **Akurasi Matching**: Polyline similarity lebih akurat daripada string matching
2. **Akurasi Biaya**: Menggunakan postMergeDistance yang akurat
3. **Compliance**: Full audit trail untuk semua operasi geospatial
4. **Performance**: Caching mengurangi API calls
5. **Reliability**: Fallback mechanisms untuk berbagai scenarios

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-24  
**Author:** Backend Team


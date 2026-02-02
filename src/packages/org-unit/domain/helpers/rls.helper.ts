import { globalLogger as Logger } from '@/shared/utils/logger';
import { OrganizationUnit } from '@prisma/client';

/**
 * Get all descendant organization unit codes for a given parent code
 * This is used for Row-Level Security (RLS) to determine which units
 * a user can access based on their organization hierarchy
 *
 * @param parentCode The parent organization unit code
 * @param allUnits All organization units in the system
 * @returns Array of descendant codes (including the parent itself)
 */
export function getOrgDescendants(parentCode: string, allUnits: OrganizationUnit[]): string[] {
  const result: string[] = [parentCode]; // Include the parent itself
  const unitMap = new Map<string, OrganizationUnit>();

  // Build a map for quick lookup
  for (const unit of allUnits) {
    unitMap.set(unit.code, unit);
  }

  // Find all children recursively
  const findChildren = (code: string, visited: Set<string> = new Set()) => {
    // Prevent infinite loops in case of circular references
    if (visited.has(code)) {
      Logger.warn(
        `Circular reference detected in organization hierarchy at code: ${code}`,
        'OrgUnitRLSHelper.getOrgDescendants',
      );
      return;
    }

    visited.add(code);

    for (const unit of allUnits) {
      if (unit.parentCode === code && !result.includes(unit.code)) {
        result.push(unit.code);
        findChildren(unit.code, visited);
      }
    }
  };

  findChildren(parentCode);
  return result;
}

/**
 * Get all ancestor organization unit codes for a given child code
 * This can be used to traverse up the hierarchy
 *
 * @param childCode The child organization unit code
 * @param allUnits All organization units in the system
 * @returns Array of ancestor codes (from immediate parent to root)
 */
export function getOrgAncestors(childCode: string, allUnits: OrganizationUnit[]): string[] {
  const result: string[] = [];
  const unitMap = new Map<string, OrganizationUnit>();

  // Build a map for quick lookup
  for (const unit of allUnits) {
    unitMap.set(unit.code, unit);
  }

  const visited = new Set<string>();
  let current = unitMap.get(childCode);

  while (current?.parentCode) {
    // Prevent infinite loops
    if (visited.has(current.parentCode)) {
      Logger.warn(
        `Circular reference detected in organization hierarchy at code: ${current.parentCode}`,
        'OrgUnitRLSHelper.getOrgAncestors',
      );
      break;
    }

    visited.add(current.parentCode);
    result.push(current.parentCode);
    current = unitMap.get(current.parentCode);
  }

  return result;
}

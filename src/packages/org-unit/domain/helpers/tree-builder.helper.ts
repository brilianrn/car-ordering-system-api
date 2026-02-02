import { globalLogger as Logger } from '@/shared/utils/logger';
import { OrganizationUnit } from '@prisma/client';
import { IOrgUnitTreeNode } from '../../dto';

/**
 * Build a hierarchical tree structure from a flat list of organization units
 * @param units Flat list of organization units
 * @returns Array of root nodes with nested children
 */
export function buildOrgUnitTree(units: OrganizationUnit[]): IOrgUnitTreeNode[] {
  // Create a map for quick lookup
  const unitMap = new Map<string, IOrgUnitTreeNode>();
  const rootNodes: IOrgUnitTreeNode[] = [];

  // First pass: Create all nodes
  for (const unit of units) {
    unitMap.set(unit.code, {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      type: unit.type,
      parentCode: unit.parentCode,
      costCenter: (unit as any).costCenter || null,
      children: [],
    });
  }

  // Second pass: Build tree structure and detect cycles
  const visited = new Set<string>();
  const inProgress = new Set<string>();

  for (const unit of units) {
    if (!visited.has(unit.code)) {
      if (hasCycle(unit.code, unitMap, visited, inProgress)) {
        Logger.warn(
          `Cycle detected in organization unit hierarchy starting at code: ${unit.code}`,
          'OrgUnitTreeBuilder.buildOrgUnitTree',
        );
        // Skip this unit to prevent infinite loop
        continue;
      }
    }

    const node = unitMap.get(unit.code);
    if (!node) continue;

    if (unit.parentCode) {
      const parent = unitMap.get(unit.parentCode);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    } else {
      // No parent, this is a root node
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

/**
 * Detect cycles in the organization unit hierarchy using DFS
 * @param code Current unit code
 * @param unitMap Map of all units
 * @param visited Set of visited nodes
 * @param inProgress Set of nodes currently being processed
 * @returns true if a cycle is detected
 */
function hasCycle(
  code: string,
  unitMap: Map<string, IOrgUnitTreeNode>,
  visited: Set<string>,
  inProgress: Set<string>,
): boolean {
  if (inProgress.has(code)) {
    // Found a back edge - cycle detected
    return true;
  }

  if (visited.has(code)) {
    // Already processed this node
    return false;
  }

  visited.add(code);
  inProgress.add(code);

  const node = unitMap.get(code);
  if (node && node.parentCode) {
    if (hasCycle(node.parentCode, unitMap, visited, inProgress)) {
      return true;
    }
  }

  inProgress.delete(code);
  return false;
}

/**
 * Flatten a tree structure back into a list (for testing/debugging)
 * @param tree Tree nodes
 * @returns Flat list of all nodes
 */
export function flattenOrgUnitTree(tree: IOrgUnitTreeNode[]): IOrgUnitTreeNode[] {
  const result: IOrgUnitTreeNode[] = [];

  function traverse(nodes: IOrgUnitTreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return result;
}

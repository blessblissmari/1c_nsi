import { useState } from "react";
import { ChevronDown, ChevronRight, Network } from "lucide-react";

export interface TreeNode {
  id: number;
  name: string;
  parent_id: number | null;
  level_type: string;
  children: TreeNode[];
}

interface TreeItemProps {
  node: TreeNode;
  selectedId: number | null;
  onSelect: (id: number) => void;
  depth?: number;
}

function TreeItem({ node, selectedId, onSelect, depth = 0 }: TreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer text-sm transition-colors ${
          isSelected
            ? "bg-blue-50 text-blue-700"
            : "text-slate-700 hover:bg-slate-50"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) setExpanded((v) => !v);
          onSelect(node.id);
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-slate-400 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Network
          size={12}
          className={
            isSelected ? "text-blue-600 shrink-0" : "text-slate-400 shrink-0"
          }
        />
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface HierarchyTreeProps {
  tree: TreeNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function HierarchyTree({
  tree,
  selectedId,
  onSelect,
}: HierarchyTreeProps) {
  if (!tree.length) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        Загрузите иерархию оборудования
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

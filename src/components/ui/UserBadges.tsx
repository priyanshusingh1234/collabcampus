import React from "react";
import { Badge as Chip } from "./badge";
import * as Icons from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { getBadgeMeta } from "@/lib/achievements";

interface UserBadgesProps {
  badges: string[]; // array of badge labels
  compact?: boolean;
}

export function UserBadges({ badges, compact = false }: UserBadgesProps) {
  if (!badges || badges.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex gap-2 flex-wrap mt-2">
        {badges.map((label, idx) => {
          const meta = getBadgeMeta(label);
          const IconComp = (Icons as any)[meta.icon] || (Icons as any)["BadgeCheck"];
          const color = meta.color;
          const colorClasses = compact
            ? `border-${color}-300 text-${color}-700 dark:text-${color}-300`
            : `bg-${color}-100 text-${color}-800 border-${color}-200 dark:bg-${color}-900/40 dark:text-${color}-200 dark:border-${color}-700`;
          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <Chip
                  variant="secondary"
                  className={`flex items-center gap-1 border ${colorClasses}`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span className={compact ? "text-xs" : "text-xs font-medium"}>{label}</span>
                </Chip>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex items-start gap-2">
                  <IconComp className="w-4 h-4 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">{label}</div>
                    <div className="text-xs opacity-80">{meta.description}</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

import type {
  User,
  UserLimits,
  Trade,
  LimitBreach,
  ConnectedAccount,
} from "@/app/generated/prisma/client";
import type {
  UserRole,
  TradeDirection,
  TradeStatus,
  BreachType,
  BreachSeverity,
} from "@/app/generated/prisma/enums";

// Re-export Prisma types
export type {
  User,
  UserLimits,
  Trade,
  LimitBreach,
  ConnectedAccount,
  UserRole,
  TradeDirection,
  TradeStatus,
  BreachType,
  BreachSeverity,
};

// Extended types with relations
export type UserWithRelations = User & {
  limits?: UserLimits | null;
  trades?: Trade[];
  breaches?: LimitBreach[];
};

export type TradeWithBreaches = Trade & {
  breaches?: LimitBreach[];
};

export type LimitBreachWithRelations = LimitBreach & {
  user?: User;
  trade?: Trade | null;
};

// Dashboard stats
export type DashboardStats = {
  totalTrades: number;
  openTrades: number;
  totalPnl: number;
  dailyPnl: number;
  dailyDrawdown: number;
  activeBreaches: number;
  consecutiveLosses: number;
};

// Limit status check result
export type LimitCheckResult = {
  isWithinLimits: boolean;
  warnings: Array<{
    type: BreachType;
    message: string;
    currentValue: number;
    limitValue: number;
    percentUsed: number;
  }>;
  violations: Array<{
    type: BreachType;
    message: string;
    currentValue: number;
    limitValue: number;
  }>;
};

import { Router } from "express";
import type { TenantDeployment } from "../t3n/tenant-setup.js";
export declare function createApiRouter(privalend: TenantDeployment | null, consortium: TenantDeployment | null): Router;

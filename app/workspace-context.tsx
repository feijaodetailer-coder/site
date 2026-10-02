"use client";
import { createContext } from "react";
export const WorkspaceContext = createContext<{navigate:(tab:string)=>void}|null>(null);

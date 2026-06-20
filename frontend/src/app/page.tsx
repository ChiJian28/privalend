"use client";

import { Workspace } from "@/components/workspace/Workspace";
import { useWorkflow } from "@/hooks/useWorkflow";

export default function Home() {
  const workflow = useWorkflow();
  return <Workspace workflow={workflow} />;
}

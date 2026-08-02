"use client";

import { Suspense } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useNavigation } from "@/app/contexts/NavigationContext";
import { useNotifications } from "@/app/contexts/NotificationContext";
import { resolveModule, isSpecialFeature } from "@/app/module-registry";
import { isWorkflowDesignFeature, type WorkflowDeployment, type WorkflowForm, type WorkflowModel } from "@/app/WorkflowDesignModule";
import { isWorkflowTaskFeature } from "@/app/components/workflow/WorkflowTaskModule";
import type { StudentEditor, StudentQuery, StudentRecord } from "@/app/components/student/student-types";

// Special modules that need custom props (not lazy-loaded since they're always needed)
import { StudentHomeModule } from "@/app/components/student/StudentHomeModule";
import { StudentPage } from "@/app/components/student/StudentPage";
import WorkflowDesignModule from "@/app/WorkflowDesignModule";
import { WorkflowTaskModule } from "@/app/components/workflow/WorkflowTaskModule";

interface WorkspaceProps {
  studentRows: StudentRecord[];
  studentTotal: number;
  studentQuery: StudentQuery;
  onStudentQueryChange: (next: StudentQuery) => void;
  onStudentAdd: () => void;
  onStudentOpenRecord: (mode: "view" | "edit", student: StudentRecord) => void;
  onStudentImported: (rows: StudentRecord[]) => void;
  studentEditor: StudentEditor;
  workflowModels: WorkflowModel[];
  setWorkflowModels: React.Dispatch<React.SetStateAction<WorkflowModel[]>>;
  workflowForms: WorkflowForm[];
  setWorkflowForms: React.Dispatch<React.SetStateAction<WorkflowForm[]>>;
  workflowDeployments: WorkflowDeployment[];
  setWorkflowDeployments: React.Dispatch<React.SetStateAction<WorkflowDeployment[]>>;
  moduleDescriptions: Record<string, string>;
}

function ModuleLoading() {
  return (
    <div className="module-card" style={{ padding: 48, textAlign: "center", opacity: 0.6 }}>
      加载模块中…
    </div>
  );
}

export function Workspace(props: WorkspaceProps) {
  const { csrfToken, currentUser, currentRole } = useAuth();
  const { activeSystem, activeFeature, active, navigateToFeature } = useNavigation();
  const { notificationFocus, consumeFocus } = useNotifications();

  // Special features with custom rendering
  if (isSpecialFeature(activeFeature, activeSystem)) {
    if (activeFeature === "student-home") {
      return <StudentHomeModule currentUser={currentUser} onNavigate={navigateToFeature} />;
    }
    if (activeSystem === "student" && activeFeature === "students") {
      return (
        <StudentPage
          rows={props.studentRows}
          total={props.studentTotal}
          query={props.studentQuery}
          onQueryChange={props.onStudentQueryChange}
          role={currentRole}
          onAdd={props.onStudentAdd}
          onOpenRecord={props.onStudentOpenRecord}
          onImported={props.onStudentImported}
        />
      );
    }
    if (activeSystem === "admin" && isWorkflowDesignFeature(activeFeature)) {
      return (
        <WorkflowDesignModule
          key={activeFeature}
          featureId={activeFeature}
          models={props.workflowModels}
          setModels={props.setWorkflowModels}
          forms={props.workflowForms}
          setForms={props.setWorkflowForms}
          deployments={props.workflowDeployments}
          setDeployments={props.setWorkflowDeployments}
        />
      );
    }
    if (isWorkflowTaskFeature(activeFeature)) {
      return (
        <WorkflowTaskModule
          key={activeFeature}
          featureId={activeFeature}
          feature={active?.label ?? "我的事务"}
          csrfToken={csrfToken}
          currentUser={currentUser}
          focusInstanceId={notificationFocus}
          onConsumedFocus={consumeFocus}
        />
      );
    }
  }

  // Registry-based module resolution with lazy loading
  const resolved = resolveModule(activeFeature);
  const ModuleComponent = resolved.component;

  // Build props based on category
  let moduleProps: Record<string, unknown>;
  switch (resolved.category) {
    case "entity":
      moduleProps = { key: activeFeature, featureId: activeFeature, csrfToken };
      break;
    case "admin-csrf":
      moduleProps = { csrfToken };
      break;
    case "admin-plain":
      moduleProps = {};
      break;
    case "log":
      moduleProps = { feature: resolved.logLabel ?? active?.label ?? "日志" };
      break;
    case "shell":
      moduleProps = { key: activeFeature, featureId: activeFeature, feature: active?.label ?? "功能模块", description: "该功能尚未开放，敬请期待。", stage: active?.stage, csrfToken, currentUser };
      break;
    default: // "generic"
      moduleProps = {
        key: activeFeature,
        featureId: activeFeature,
        feature: active?.label ?? "业务模块",
        description: props.moduleDescriptions[activeFeature],
        stage: active?.stage,
        csrfToken,
        currentUser,
      };
  }

  return (
    <Suspense fallback={<ModuleLoading />}>
      <ModuleComponent {...moduleProps} />
    </Suspense>
  );
}

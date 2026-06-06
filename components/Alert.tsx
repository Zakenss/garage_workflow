type AlertVariant = "success" | "error" | "warning" | "info";

const VARIANT_CLASS: Record<AlertVariant, string> = {
  success: "alert-success",
  error: "alert-error",
  warning: "alert-warning",
  info: "alert-info",
};

export function Alert({
  variant = "info",
  children,
  className = "",
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`${VARIANT_CLASS[variant]} ${className}`}
    >
      {children}
    </div>
  );
}

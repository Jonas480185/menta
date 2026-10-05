import { Button, type ButtonProps } from "./button";

const sizeMap = { sm: "icon-sm", md: "icon", lg: "icon-lg" } as const;

export interface IconButtonProps extends Omit<ButtonProps, "size" | "aria-label"> {
  /** Required accessible name (German), e.g. "Eintrag löschen". */
  label: string;
  /** Visual size: every size keeps a ≥ 44 px hit area on touch devices. */
  size?: keyof typeof sizeMap;
}

/** Icon-only button. Pass the lucide icon as child; `label` becomes its accessible name. */
function IconButton({ label, size = "md", variant = "ghost", ...props }: IconButtonProps) {
  return <Button aria-label={label} size={sizeMap[size]} variant={variant} {...props} />;
}

export { IconButton };

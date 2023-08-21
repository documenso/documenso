import React from "react";
import { getInitials } from "@documenso/lib/helpers";
import "./userAvatar.css";
import * as Avatar from "@radix-ui/react-avatar";

interface AvatarProps {
  fallbackText?: string;
  imageSrc?: string;
}

export function UserAvatar({ fallbackText, imageSrc }: AvatarProps) {
  const nameInitials = getInitials(fallbackText ?? "")?.toUpperCase();

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <Avatar.Root className="AvatarRoot">
        <Avatar.Image className="AvatarImage" src={imageSrc} alt={nameInitials} />
        <Avatar.Fallback className="AvatarFallback" delayMs={600}>
          {nameInitials}
        </Avatar.Fallback>
      </Avatar.Root>
    </div>
  );
}

"use client";

import { Toaster } from "sonner";
import "sonner/dist/styles.css";

export function PhoneToaster() {
  return (
    <Toaster
      position="top-center"
      duration={4500}
      visibleToasts={1}
      closeButton
      offset={{ top: 72 }}
      mobileOffset={{ top: 72 }}
      toastOptions={{
        closeButtonAriaLabel: "ปิด",
        style: { width: "min(420px, calc(100vw - 32px))" },
      }}
    />
  );
}

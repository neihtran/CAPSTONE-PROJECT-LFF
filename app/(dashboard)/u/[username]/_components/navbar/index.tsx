import React from "react";

import { Logo } from "./logo";
import { Actions } from "./actions";

export function Navbar() {
  return (
    <div className="fixed top-0 w-full h-20 z-[49] bg-[#252731] px-2 lg:px-4 shadow-sm">
      <div className="max-w-[1600px] mx-auto h-full flex justify-between items-center gap-x-4">
        <Logo />
        <Actions />
      </div>
    </div>
  );
}

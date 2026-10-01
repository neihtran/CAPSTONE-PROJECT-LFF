import React from "react";

import { Logo } from "./logo";
import { Search } from "./search";
import { Actions } from "./actions";

export function Navbar() {
  return (
    <div className="fixed top-0 w-full h-20 z-[49] bg-background px-2 lg:px-4 border-b shadow-sm">
      <div className="max-w-[1600px] mx-auto h-full flex justify-between items-center gap-x-4">
        <Logo />
        <div className="flex-1 max-w-xl">
          <Search />
        </div>
        <Actions />
      </div>
    </div>
  );
}
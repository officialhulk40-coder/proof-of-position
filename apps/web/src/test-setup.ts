// Vitest runs without globals, so Testing Library cannot register its own cleanup.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

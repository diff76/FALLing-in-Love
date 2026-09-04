import { Home } from "../page";

export const metadata = { title: "FALLing in Love · Syne title" };

/** Comparison route: the same home page with the Syne title lockup. */
export default function SyneHomePage() {
  return <Home titleFont="syne" />;
}

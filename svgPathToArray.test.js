import { parsePathSVG } from "https://code4fukui.github.io/sabae-font/parsePathSVG.js";
import { svgPathToArray } from "./svgPathToArray.js";

// todo: change to test
const svg = await Deno.readTextFile("temp/9.svg");
const d = parsePathSVG(svg);
const path = svgPathToArray(d.path);
console.log(path);

import { describe, expect, it } from "vitest";
import { searchTerms } from "../src/utils/searchTerms.js";

describe("searchTerms", () => {
  it("keeps original Korean query terms and adds lightweight normalized terms", () => {
    expect(searchTerms("강아지 입양한 기억")).toEqual(["강아지", "입양한", "입양", "기억"]);
    expect(searchTerms("공원에서 산책했던 기억")).toEqual(["공원에서", "공원", "산책했던", "산책", "기억"]);
  });
});

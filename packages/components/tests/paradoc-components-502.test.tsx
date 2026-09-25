import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Pages } from "../src";
import { ArabicLetterDocument, arabicLetterData, arabicLetterTokens } from "../src/examples";

it("renders the Arabic letter when its caller supplies the declared tokens", () => {
  const html = renderToStaticMarkup(
    <Pages>
      <ArabicLetterDocument data={arabicLetterData} tokens={arabicLetterTokens} />
    </Pages>
  );
  expect(html).toContain('dir="rtl"');
  expect(html).toContain('lang="ar"');
});

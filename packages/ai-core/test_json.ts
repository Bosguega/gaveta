import { extractJsonFromResponse } from './src/parsing/extractJson';

const response = `
Aqui está o JSON extraído:

\`\`\`json
[
  {
    "key": "CERV BRAHMA LTA 350ML",
    "normalized_name": "Cerveja Brahma Lata 350ml",
    "category": "Bebidas",
    "brand": "Brahma",
    "slug": "cerveja_brahma_350ml"
  }
]
\`\`\`
`;

const parsed = extractJsonFromResponse(response);
console.log(parsed);

const response2 = `[{"key": "test"}]`;
console.log(extractJsonFromResponse(response2));

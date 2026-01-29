// utils/quotes.js - Motivační citáty pro pauzy

export const quotes = [
  "Odpočinek je součástí práce.",
  "Každý hovor je nová šance.",
  "Kvalita vítězí nad kvantitou.",
  "Tvůj hlas mění životy.",
  "Pauza je investice do výkonu.",
  "Dýchej. Soustřeď se. Volej.",
  "Úspěch je součet malých kroků.",
  "Vytrvalost poráží talent.",
  "Dnes je den pro nový rekord.",
  "Každý NE tě přibližuje k ANO.",
  "Pozitivní přístup = pozitivní výsledky.",
  "Jsi lepší, než si myslíš.",
  "Fokus na řešení, ne na problém.",
  "Tvůj potenciál je neomezený.",
  "Malé vítězství je také vítězství.",
  "Energie následuje pozornost.",
  "Dnes překonáš včerejšek.",
  "Každý hovor je příležitost.",
  "Sebedisciplína = svoboda.",
  "Úspěch miluje připravenost.",
  "Neboj se velkých cílů.",
  "Tvá práce má smysl.",
  "Postupuj krok za krokem.",
  "Motivace přichází s akcí.",
  "Jsi architekt svého dne.",
  "Soustředění je superschopnost.",
  "Každý má právo na pauzu.",
  "Výdrž definuje vítěze.",
  "Dnes je nový začátek.",
  "Tvůj přístup určuje výsledek.",
  "Klid mysli = síla v hlase.",
  "Chyba je jen učitelka.",
  "Pomalý progres je stále progres.",
  "Buď trpělivý, ale vytrvalý.",
  "Tvá hodnota není v číslech.",
  "Oddech nabíjí výkon.",
  "Soustřeď se na to, co můžeš ovlivnit.",
  "Úspěch je o konzistenci.",
  "Důvěřuj procesu.",
  "Každé ráno je šance začít znovu.",
  "Tvé úsilí se počítá.",
  "Mysli na cíl, ne na překážky.",
  "Síla je v přítomném okamžiku.",
  "Neboj se zeptat na pomoc.",
  "Tvá energie je nakažlivá.",
  "Odpočiň si a vrať se silnější.",
  "Fokus přináší výsledky.",
  "Dnes je tvůj den.",
  "Malá pauza, velký efekt.",
  "Věř ve svou cestu.",
  "Jednoduchý plán, silná akce.",
  "Překážky tě posilují.",
  "Cesta je důležitější než cíl.",
  "Tvé myšlenky tvoří realitu.",
  "Každá minuta odpočinku se vrátí.",
  "Netlač na sebe příliš tvrdě."
];

/**
 * Vrátí citát pro daný blok (deterministicky podle ID bloku)
 */
export function getQuoteForBlock(blockId) {
  if (!quotes || quotes.length === 0) return "Odpočívej.";
  const idNum = blockId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = idNum % quotes.length;
  return quotes[index];
}

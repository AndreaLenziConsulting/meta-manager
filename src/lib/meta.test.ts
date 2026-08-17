import { describe, expect, it } from "vitest";
import { extractLeads } from "./meta";
import type { MetaAction } from "./meta";

function azione(action_type: string, value: string): MetaAction {
  return { action_type, value };
}

describe("extractLeads", () => {
  it("nessuna azione -> 0", () => {
    expect(extractLeads(undefined)).toBe(0);
    expect(extractLeads([])).toBe(0);
  });

  it("senza tipoConversioneLead, usa la lista di default in ordine di priorità", () => {
    const actions = [azione("lead", "5"), azione("onsite_conversion.lead_grouped", "3")];
    // onsite_conversion.lead_grouped ha priorità più alta di "lead" — stesso evento, non si sommano.
    expect(extractLeads(actions)).toBe(3);
  });

  it("fallback su offsite_conversion.fb_pixel_lead se gli altri due non ci sono", () => {
    const actions = [azione("landing_page_view", "100"), azione("offsite_conversion.fb_pixel_lead", "7")];
    expect(extractLeads(actions)).toBe(7);
  });

  it("nessun tipo riconosciuto nella lista di default -> 0, anche con altre azioni presenti", () => {
    const actions = [azione("complete_registration", "41"), azione("link_click", "455")];
    expect(extractLeads(actions)).toBe(0);
  });

  it("con tipoConversioneLead impostato, usa SOLO quello — ignora i tipi della lista di default anche se presenti", () => {
    const actions = [
      azione("offsite_conversion.fb_pixel_complete_registration", "41"),
      azione("lead", "999"), // non deve mai essere sommato/usato quando è impostato un tipo esplicito
    ];
    expect(extractLeads(actions, "offsite_conversion.fb_pixel_complete_registration")).toBe(41);
  });

  it("tipoConversioneLead impostato ma assente tra le azioni -> 0, nessun fallback silenzioso sulla lista di default", () => {
    const actions = [azione("lead", "10")];
    expect(extractLeads(actions, "offsite_conversion.fb_pixel_complete_registration")).toBe(0);
  });

  it("value mancante o non numerico -> 0", () => {
    expect(extractLeads([azione("lead", "")])).toBe(0);
  });
});

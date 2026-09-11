-- satzspiegel.lua — Pandoc filter for the Satzspiegel stylesheet.
--   * wraps every table in <div class="md-table-scroll"> so wide tables scroll
--     inside the measure instead of breaking the page
--   * adds data-label="<column head>" to each body cell, which the
--     .md-table--stack variant reads on narrow screens
-- Alerts, footnotes, task lists and code need no filter: the stylesheet
-- reads Pandoc's own markup.

local stringify = pandoc.utils.stringify

function Table(tbl)
  local heads = {}
  if tbl.head and tbl.head.rows[1] then
    for i, cell in ipairs(tbl.head.rows[1].cells) do
      heads[i] = stringify(cell.contents)
    end
  end
  for _, body in ipairs(tbl.bodies) do
    for _, row in ipairs(body.body) do
      for i, cell in ipairs(row.cells) do
        if heads[i] and heads[i] ~= "" then
          cell.attr.attributes["data-label"] = heads[i]
        end
      end
    end
  end
  return pandoc.Div({ tbl }, pandoc.Attr("", { "md-table-scroll" }))
end

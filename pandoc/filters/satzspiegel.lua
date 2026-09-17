-- satzspiegel.lua — Pandoc filter for the Satzspiegel stylesheet.
--   * wraps every table in <div class="md-table-scroll"> so wide tables scroll
--     inside the measure instead of breaking the page
--   * adds data-label="<column head>" to each body cell, which the
--     .md-table--stack variant reads on narrow screens
--   * draws diagrams at render time: fenced mermaid (and dot, plantuml, tikz)
--     blocks go through the diagram filter of the Pandoc project
--     (github.com/pandoc-ext/diagram 1.2.0, MIT), which sits unmodified beside
--     this file as satzspiegel-diagram.lua, and come back as SVG images. This
--     file gives mermaid the theme's colours first, and afterwards writes each
--     image into the page as a data URI inside <figure class="md-diagram">,
--     so a linked page needs no extra file and a review edition keeps the
--     diagram's labels out of its text index. Without mermaid-cli (`mmdc`)
--     the block stays a code block and one warning says how to install it.
-- Alerts, footnotes, task lists and code need no filter: the stylesheet
-- reads Pandoc's own markup.

local stringify = pandoc.utils.stringify
local path = pandoc.path

-- ---------------------------------------------------------------- tables

local function Table(tbl)
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

-- -------------------------------------------------------------- diagrams

-- The theme tokens of satzspiegel.css a diagram needs. An SVG shown through
-- <img> cannot reach the page's custom properties or its web fonts, so the
-- values are repeated here and the faces are system stacks: the labels are
-- measured on the author's machine and must fit on the reader's.
local palettes = {
  patina = {
    paper = "#F3F6F4", sunk = "#E4EBE7", ink = "#1D2A24", muted = "#56705F",
    rule = "#C7D5CC", spot = "#2F5B4A",
    face = '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  archive = {
    paper = "#F5F1EA", sunk = "#E9E3D8", ink = "#2B2B2A", muted = "#6B655D",
    rule = "#D7D0C6", spot = "#2F3E63",
    face = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
}

-- One forme: paper and sunk paper for fills, ink for words, muted ink for
-- lines, the spot only where mermaid marks what is active or critical.
local function mermaid_init(p)
  local config = {
    theme = "base",
    -- HTML labels are foreignObject, which an SVG inside <img> may not draw.
    htmlLabels = false,
    flowchart = { htmlLabels = false },
    class = { htmlLabels = false },
    fontFamily = p.face,
    -- d3 draws the gantt grid in currentColor, which is black inside <img>.
    themeCSS = ".grid .tick line { stroke: " .. p.rule .. "; }",
    themeVariables = {
      fontFamily = p.face, fontSize = "14px",
      background = p.paper,
      primaryColor = p.sunk, primaryTextColor = p.ink, primaryBorderColor = p.muted,
      secondaryColor = p.paper, secondaryTextColor = p.ink, secondaryBorderColor = p.rule,
      tertiaryColor = p.paper, tertiaryTextColor = p.ink, tertiaryBorderColor = p.rule,
      lineColor = p.muted, textColor = p.ink, titleColor = p.ink,
      mainBkg = p.sunk, nodeBorder = p.muted,
      clusterBkg = p.paper, clusterBorder = p.rule,
      edgeLabelBackground = p.paper,
      noteBkgColor = p.paper, noteTextColor = p.ink, noteBorderColor = p.rule,
      actorBkg = p.sunk, actorBorder = p.muted, actorTextColor = p.ink, actorLineColor = p.rule,
      signalColor = p.muted, signalTextColor = p.ink,
      labelBoxBkgColor = p.paper, labelBoxBorderColor = p.rule, labelTextColor = p.ink,
      loopTextColor = p.ink,
      activationBkgColor = p.paper, activationBorderColor = p.spot,
      sequenceNumberColor = p.paper,
      sectionBkgColor = p.sunk, altSectionBkgColor = p.paper, sectionBkgColor2 = p.sunk,
      gridColor = p.rule, todayLineColor = p.spot,
      taskBkgColor = p.sunk, taskBorderColor = p.muted,
      taskTextColor = p.ink, taskTextDarkColor = p.ink, taskTextOutsideColor = p.ink,
      activeTaskBkgColor = p.paper, activeTaskBorderColor = p.muted,
      doneTaskBkgColor = p.rule, doneTaskBorderColor = p.muted,
      critBkgColor = p.sunk, critBorderColor = p.spot,
      pie1 = p.spot, pie2 = p.muted, pie3 = p.rule, pie4 = p.sunk, pie5 = p.ink,
      pieStrokeColor = p.paper, pieOuterStrokeColor = p.rule,
      pieTitleTextColor = p.ink, pieSectionTextColor = p.paper, pieLegendTextColor = p.ink,
    },
  }
  return "%%{init: " .. pandoc.json.encode(config) .. "}%%\n"
end

--- True if `name` can be started: MERMAID_BIN is set, or the file is on PATH.
local function on_path(name)
  local env = os.getenv "MERMAID_BIN"
  if env and env ~= "" then return true end
  local windows = pandoc.system.os == "mingw32" or pandoc.system.os == "windows"
  local sep = windows and ";" or ":"
  local suffixes = windows and { ".cmd", ".exe", ".bat", "" } or { "" }
  for dir in (os.getenv "PATH" or ""):gmatch("[^" .. sep .. "]+") do
    for _, suffix in ipairs(suffixes) do
      local fh = io.open(path.join { dir, name .. suffix }, "rb")
      if fh then fh:close() return true end
    end
  end
  return false
end

local function theme_of(meta)
  local v = PANDOC_WRITER_OPTIONS.variables and PANDOC_WRITER_OPTIONS.variables.theme
  local name = v and tostring(v) or (meta.theme and stringify(meta.theme)) or "patina"
  return palettes[name] or palettes.patina
end

--- The directive `prepare` wrote into the mermaid blocks of this document.
local injected

--- Before the diagram filter: theme each mermaid block, or step it aside.
local function prepare(doc)
  local have_mmdc, left = nil, 0
  local init = mermaid_init(theme_of(doc.meta))
  injected = init

  doc = doc:walk {
    CodeBlock = function(cb)
      if cb.classes[1] ~= "mermaid" then return nil end
      if have_mmdc == nil then have_mmdc = on_path "mmdc" end
      if not have_mmdc then
        -- Not the first class any more, so the diagram filter passes it by.
        cb.classes:insert(1, "md-diagram-source")
        left = left + 1
        return cb
      end
      -- An author who configures the diagram keeps control of it.
      if cb.text:find("%%%%{%s*init") or cb.text:find("^%-%-%-") then return nil end
      -- `%%| key: value` lines are the diagram filter's options and stay on top.
      local options, rest = "", cb.text
      while rest:find("^%%%%|[^\n]*\n") do
        local line = rest:match("^%%%%|[^\n]*\n")
        options, rest = options .. line, rest:sub(#line + 1)
      end
      cb.text = options .. init .. rest
      return cb
    end,
  }

  if left > 0 then
    warn(string.format(
      "satzspiegel: %d mermaid block%s left as code, because mmdc is not installed. " ..
      "npm install -g @mermaid-js/mermaid-cli", left, left == 1 and "" or "s"))
  end

  -- Drawing a diagram starts a browser and takes seconds; keep the result.
  if have_mmdc and doc.meta.diagram == nil then
    doc.meta.diagram = { cache = true }
  end
  return doc
end

local b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local function base64(data)
  local out = {}
  for i = 1, #data, 3 do
    local a, b, c = data:byte(i, i + 2)
    local n = a * 65536 + (b or 0) * 256 + (c or 0)
    local c1, c2 = (n >> 18) & 63, (n >> 12) & 63
    local c3, c4 = (n >> 6) & 63, n & 63
    out[#out + 1] = b64chars:sub(c1 + 1, c1 + 1) .. b64chars:sub(c2 + 1, c2 + 1) ..
      (b and b64chars:sub(c3 + 1, c3 + 1) or "=") ..
      (c and b64chars:sub(c4 + 1, c4 + 1) or "=")
  end
  return table.concat(out)
end

--- After the diagram filter: an image it left in the media bag goes into the
--- page itself, at its drawn size, on the page's own paper.
local function embed(img)
  local mime, data = pandoc.mediabag.lookup(img.src)
  if not mime then return nil end
  if mime:find("^image/svg") then
    -- mermaid-cli paints a white ground; the paper is the page's.
    data = data:gsub("background%-color:%s*white;?%s*", "", 1)
    if not img.attributes.width and not img.attributes.height then
      local w = data:match('<svg[^>]-viewBox="[%d%.%-]+[%s,]+[%d%.%-]+[%s,]+([%d%.]+)')
      if w then img.attributes.width = string.format("%dpx", math.ceil(tonumber(w))) end
    end
  end
  img.src = "data:" .. mime:gsub(";.*", "") .. ";base64," .. base64(data)
  img.classes:insert("md-diagram-image")
  return img
end

local function is_diagram(block)
  local first = block.content and block.content[1]
  return #block.content == 1 and first.t == "Image" and first.classes:includes "md-diagram-image"
end

local finish = {
  Image = embed,
  -- A block mmdc could not draw stays code; take our directive out again.
  CodeBlock = function(cb)
    if not injected or cb.classes[1] ~= "mermaid" then return nil end
    local from, to = cb.text:find(injected, 1, true)
    if from then
      cb.text = cb.text:sub(1, from - 1) .. cb.text:sub(to + 1)
      return cb
    end
  end,
  -- The diagram filter returns a bare image when there is no caption; give it
  -- the figure the stylesheet spaces and lets break out of the measure.
  Plain = function(plain)
    if is_diagram(plain) then
      return pandoc.Figure({ plain }, {}, pandoc.Attr("", { "md-diagram" }))
    end
  end,
  -- With a caption the diagram filter made the figure itself, and the Plain
  -- rule above has just nested a second one inside it; fold the two.
  Figure = function(fig)
    local first = fig.content[1]
    if #fig.content == 1 and first.t == "Figure" and first.classes:includes "md-diagram" then
      fig.content = first.content
      fig.classes:insert "md-diagram"
      return fig
    end
  end,
}

local filters = { { Table = Table } }

local ok, diagram = pcall(dofile, path.join { path.directory(PANDOC_SCRIPT_FILE), "satzspiegel-diagram.lua" })
if ok and type(diagram) == "table" then
  filters[#filters + 1] = { Pandoc = prepare }
  for _, f in ipairs(diagram) do filters[#filters + 1] = f end
  filters[#filters + 1] = finish
end

return filters

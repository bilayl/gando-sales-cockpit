"use client";

import {
  Braces,
  ChevronRight,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Info,
  List,
  ListOrdered,
  MessageSquareQuote,
  Table2,
  Text,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SlashCommandId =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "blockquote"
  | "unordered-list"
  | "ordered-list"
  | "table"
  | "code"
  | "callout"
  | "tabs"
  | "steps";

type SlashCommand = {
  id: SlashCommandId;
  label: string;
  hint: string;
  group: "Basic Blocks" | "Lists and Tables" | "Advanced";
  icon: typeof Text;
  previewTitle: string;
  previewDescription: string;
};

export const DEVELOPER_SLASH_COMMANDS: SlashCommand[] = [
  { id: "text", label: "Text", hint: "", group: "Basic Blocks", icon: Text, previewTitle: "Text", previewDescription: "Just start with writing plain text" },
  { id: "h1", label: "Heading 1", hint: "#", group: "Basic Blocks", icon: Heading1, previewTitle: "Heading 1", previewDescription: "Large section heading" },
  { id: "h2", label: "Heading 2", hint: "##", group: "Basic Blocks", icon: Heading2, previewTitle: "Heading 2", previewDescription: "Primary content section" },
  { id: "h3", label: "Heading 3", hint: "###", group: "Basic Blocks", icon: Heading3, previewTitle: "Heading 3", previewDescription: "Nested content section" },
  { id: "h4", label: "Heading 4", hint: "####", group: "Basic Blocks", icon: Heading4, previewTitle: "Heading 4", previewDescription: "Small content heading" },
  { id: "blockquote", label: "Blockquote", hint: ">", group: "Basic Blocks", icon: MessageSquareQuote, previewTitle: "Blockquote", previewDescription: "Highlight a quote or important text" },
  { id: "unordered-list", label: "Unordered list", hint: "•", group: "Lists and Tables", icon: List, previewTitle: "Unordered list", previewDescription: "Create a bullet list" },
  { id: "ordered-list", label: "Ordered list", hint: "1.", group: "Lists and Tables", icon: ListOrdered, previewTitle: "Ordered list", previewDescription: "Create a numbered list" },
  { id: "table", label: "Table", hint: "", group: "Lists and Tables", icon: Table2, previewTitle: "Table", previewDescription: "Insert a Markdown table" },
  { id: "code", label: "Code block", hint: "\u0060\u0060\u0060", group: "Advanced", icon: Code2, previewTitle: "Code block", previewDescription: "Add syntax-highlighted code" },
  { id: "callout", label: "Callout", hint: "", group: "Advanced", icon: Info, previewTitle: "Callout", previewDescription: "Add a Fumadocs callout" },
  { id: "tabs", label: "Tabs", hint: "", group: "Advanced", icon: Braces, previewTitle: "Tabs", previewDescription: "Switch between multiple content variants" },
  { id: "steps", label: "Steps", hint: "", group: "Advanced", icon: Workflow, previewTitle: "Steps", previewDescription: "Build a guided multi-step flow" },
];

export function DeveloperSlashMenu({
  query,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
}: {
  query: string;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (id: SlashCommandId) => void;
}) {
  const normalized = query.trim().toLowerCase();
  const filtered = DEVELOPER_SLASH_COMMANDS.filter(command => (
    !normalized
    || command.label.toLowerCase().includes(normalized)
    || command.id.includes(normalized)
  ));

  const selected = filtered[Math.min(selectedIndex, Math.max(filtered.length - 1, 0))] || filtered[0];
  const groups = ["Basic Blocks", "Lists and Tables", "Advanced"] as const;

  return (
    <div className="mint-slash-menu" role="dialog" aria-label="Ajouter un bloc">
      <div className="mint-slash-list">
        {groups.map(group => {
          const commands = filtered.filter(command => command.group === group);
          if (!commands.length) return null;
          return (
            <div key={group} className="mint-slash-group">
              <div className="mint-slash-group-title">{group}</div>
              {commands.map(command => {
                const index = filtered.findIndex(item => item.id === command.id);
                const Icon = command.icon;
                const active = index === selectedIndex;
                return (
                  <button
                    key={command.id}
                    type="button"
                    className={cn("mint-slash-item", active && "is-active")}
                    onMouseEnter={() => onSelectedIndexChange(index)}
                    onMouseDown={event => {
                      event.preventDefault();
                      onSelect(command.id);
                    }}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1 text-left">{command.label}</span>
                    {command.hint ? <span className="mint-slash-hint">{command.hint}</span> : null}
                    {command.id === "blockquote" ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
                  </button>
                );
              })}
            </div>
          );
        })}
        {!filtered.length ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun bloc trouvé
          </div>
        ) : null}
      </div>

      <div className="mint-slash-preview">
        <div className="mint-slash-preview-visual">
          <div className="mint-slash-preview-card">
            <span />
            <span />
            <span className="short" />
          </div>
        </div>
        <div className="mint-slash-preview-copy">
          <strong>{selected?.previewTitle || "Bloc"}</strong>
          <p>{selected?.previewDescription || "Ajoutez un bloc à la documentation."}</p>
        </div>
      </div>
    </div>
  );
}

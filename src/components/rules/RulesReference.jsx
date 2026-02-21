import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, ChevronDown, ChevronRight } from "lucide-react";

const RULES = [
  // --- Unit Special Rules ---
  { name: 'Ambush', category: 'Deployment', tag: 'unit', description: 'This unit may be held in reserve and deployed anywhere on the table at the start of any round, as long as it is placed more than 9" from all enemies.' },
  { name: 'Fast', category: 'Movement', tag: 'unit', description: 'This unit moves +2" when Advancing and +4" when Rushing or Charging.' },
  { name: 'Slow', category: 'Movement', tag: 'unit', description: 'This unit moves −2" when Advancing and −4" when Rushing or Charging.' },
  { name: 'Flying', category: 'Movement', tag: 'unit', description: 'This unit ignores terrain when moving and may move over all obstacles freely.' },
  { name: 'Strider', category: 'Movement', tag: 'unit', description: 'This unit ignores the movement penalty for moving through difficult terrain.' },
  { name: 'Scout', category: 'Deployment', tag: 'unit', description: 'When Scouting Deployment is active, this unit may redeploy to the mid-table area (12"+ from deployment zones) before Round 1 begins.' },
  { name: 'Tough(X)', category: 'Durability', tag: 'unit', description: 'This unit has X wounds instead of 1 per model. When reduced to 0 wounds it is destroyed. Hero units with Tough also count as heroes for Heroic Actions.' },
  { name: 'Hero', category: 'Leadership', tag: 'unit', description: 'This unit is a hero and may join another unit. It may also use Heroic Actions (if that advance rule is enabled) once per battle to re-roll all dice for one action.' },
  { name: 'Fearless', category: 'Morale', tag: 'unit', description: 'When this unit fails a morale check, it may immediately re-roll the die. On a 4+ it passes instead.' },
  { name: 'Regeneration', category: 'Durability', tag: 'unit', description: 'At the end of each round, roll one die. On a 5+ this unit recovers 1 lost wound.' },
  { name: 'Self-Repair', category: 'Durability', tag: 'unit', description: 'At the end of each round, roll one die. On a 5+ this unit recovers 1 lost wound. Functionally identical to Regeneration.' },
  { name: 'Repair', category: 'Durability', tag: 'unit', description: 'At the end of each round, roll one die. On a 5+ this unit recovers 1 lost wound. Typically used for mechanical units.' },
  { name: 'Stealth', category: 'Defence', tag: 'unit', description: 'Enemies targeting this unit at ranges greater than 2" suffer a +1 penalty to their Quality roll needed to hit (e.g. Q3+ becomes Q4+).' },
  { name: 'Stealth Aura', category: 'Defence', tag: 'unit', description: 'All friendly units within 6" of this unit gain the Stealth rule while the aura bearer is alive.' },
  { name: 'Machine-Fog', category: 'Defence', tag: 'unit', description: 'Enemies targeting this unit suffer a +1 penalty to their Quality roll to hit, regardless of range.' },
  { name: 'Transport(X)', category: 'Transport', tag: 'unit', description: 'This unit can carry up to X transport points worth of friendly units. Standard units take 1 point; large units (Tough >3) take 3 points.' },
  { name: 'Shielded', category: 'Defence', tag: 'unit', description: 'Parsed and stored; in the standard rules this grants a bonus defence save against certain attacks. Currently used for army-list parsing and future implementation.' },
  { name: 'Highborn', category: 'Faction', tag: 'unit', description: 'A faction rule for High Elf units. Parsed and stored for army tracking; no direct mechanical effect in the simulator at this time.' },
  { name: 'Caster(X)', category: 'Ability', tag: 'unit', description: 'This unit has X casting dice for spell abilities. Parsed and stored; spell resolution is not yet implemented in the simulator.' },
  { name: 'Furious', category: 'Melee', tag: 'unit', description: 'When this unit charges, it gains +1 attack with each of its melee weapons for that activation.' },
  { name: 'Rage', category: 'Melee', tag: 'unit', description: 'Increases the AI priority score for charging actions, making this unit more likely to choose Charge over other actions.' },
  { name: 'Crossing Attack(X)', category: 'Melee', tag: 'unit', description: 'Parsed and stored; in the standard rules this unit deals X automatic hits when an enemy moves through or out of melee range. Not yet implemented in the simulator.' },

  // --- Weapon Special Rules ---
  { name: 'AP(X)', category: 'Weapon', tag: 'weapon', description: 'Armour Piercing X. The target\'s Defence save is worsened by X (e.g. AP(2) turns a D4+ into D6+). AP cannot raise the save requirement above 6+.' },
  { name: 'Blast(X)', category: 'Weapon', tag: 'weapon', description: 'This weapon automatically scores X hits instead of rolling to hit. These hits proceed directly to the Defence roll stage.' },
  { name: 'Deadly(X)', category: 'Weapon', tag: 'weapon', description: 'Each hit roll of X or higher counts as two hits instead of one. By default Deadly(3) means rolls of 3, 4, 5, or 6 each deal a bonus hit.' },
  { name: 'Rending', category: 'Weapon', tag: 'weapon', description: 'Unmodified hit rolls of 6 automatically wound the target, bypassing the Defence save entirely.' },
];

const CATEGORY_COLORS = {
  Deployment: 'bg-purple-900/50 text-purple-300 border-purple-700',
  Movement: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
  Durability: 'bg-green-900/50 text-green-300 border-green-700',
  Morale: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  Defence: 'bg-blue-900/50 text-blue-300 border-blue-700',
  Melee: 'bg-red-900/50 text-red-300 border-red-700',
  Weapon: 'bg-orange-900/50 text-orange-300 border-orange-700',
  Transport: 'bg-slate-700/50 text-slate-300 border-slate-500',
  Leadership: 'bg-amber-900/50 text-amber-300 border-amber-700',
  Faction: 'bg-indigo-900/50 text-indigo-300 border-indigo-700',
  Ability: 'bg-pink-900/50 text-pink-300 border-pink-700',
};

export default function RulesReference() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return RULES.filter(r =>
      (filterTag === 'all' || r.tag === filterTag) &&
      (r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
    );
  }, [search, filterTag]);

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <button
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          Special Rules Reference
          <span className="text-slate-400 font-normal text-sm">({RULES.length} rules)</span>
        </span>
        {open ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>

      {open && (
        <CardContent className="pt-0 border-t border-slate-700 space-y-4">
          {/* Search & filter */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search rules..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-900/50 border-slate-600 text-white placeholder-slate-500"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'unit', 'weapon'].map(t => (
                <button
                  key={t}
                  onClick={() => setFilterTag(t)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filterTag === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Rules grid */}
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No rules match your search.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map(rule => (
                <div key={rule.name} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">{rule.name}</span>
                    <Badge className={`text-xs border ${CATEGORY_COLORS[rule.category] || 'bg-slate-700 text-slate-300'}`}>
                      {rule.category}
                    </Badge>
                    {rule.tag === 'weapon' && (
                      <Badge className="text-xs border bg-orange-900/30 text-orange-400 border-orange-700">Weapon</Badge>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
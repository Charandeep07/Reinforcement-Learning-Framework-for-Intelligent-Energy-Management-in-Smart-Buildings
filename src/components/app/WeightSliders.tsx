import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { RewardWeights } from "@/lib/rl/reward";

export function WeightSliders({ value, onChange }: { value: RewardWeights; onChange: (w: RewardWeights) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(value) as (keyof RewardWeights)[]).map((k) => (
        <div key={k} className="space-y-1.5">
          <Label className="flex justify-between text-xs capitalize"><span>w_{k}</span><span className="font-mono">{value[k].toFixed(2)}</span></Label>
          <Slider min={0} max={3} step={0.05} value={[value[k]]} onValueChange={([v]) => onChange({ ...value, [k]: v })} />
        </div>
      ))}
    </div>
  );
}

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, money } from "@/lib/format";

export const S = (n: number) => `var(--series-${n})`;

export interface Serie { key: string; label: string; color: string; dashed?: boolean }

/** Leyenda: siempre presente con ≥2 series (identidad nunca solo por color) */
export function Legend({ series }: { series: { label: string; color: string }[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tip({ active, payload, label, labelFmt, valueFmt = (v: number) => money(v), total }: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p: any) => p.value != null && p.value !== 0);
  const sum = rows.reduce((a: number, p: any) => a + (typeof p.value === "number" ? p.value : 0), 0);
  return (
    <div className="min-w-[10rem] rounded-md border bg-card p-2.5 text-xs shadow-lg">
      <div className="mb-1.5 font-medium">{labelFmt ? labelFmt(label) : label}</div>
      {rows.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.stroke || p.fill }} />
            {p.name}
          </span>
          <span className="tabular font-medium">{valueFmt(p.value)}</span>
        </div>
      ))}
      {total && rows.length > 1 && (
        <div className="mt-1 flex justify-between border-t pt-1 font-medium">
          <span>Total</span>
          <span className="tabular">{valueFmt(sum)}</span>
        </div>
      )}
    </div>
  );
}

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const;

export function AreaTrend({ data, xKey, series, height = 260, xFmt, valueFmt, zero = true }: { data: any[]; xKey: string; series: Serie[]; height?: number; xFmt?: (v: any) => string; valueFmt?: (v: number) => string; zero?: boolean }) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xFmt} {...axisProps} minTickGap={16} />
          <YAxis tickFormatter={compactMoney} width={72} {...axisProps} domain={zero ? [(min: number) => Math.min(0, min), "auto"] : ["auto", "auto"]} />
          <Tooltip content={<Tip labelFmt={xFmt} valueFmt={valueFmt} />} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }} strokeDasharray={s.dashed ? "5 4" : undefined} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}

export function Lines({ data, xKey, series, height = 280, xFmt, valueFmt, refY }: { data: any[]; xKey: string; series: Serie[]; height?: number; xFmt?: (v: any) => string; valueFmt?: (v: number) => string; refY?: { y: number; label: string } }) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xFmt} {...axisProps} minTickGap={16} />
          <YAxis tickFormatter={compactMoney} width={72} {...axisProps} />
          <Tooltip content={<Tip labelFmt={xFmt} valueFmt={valueFmt} />} />
          {refY && <ReferenceLine y={refY.y} stroke="var(--axis)" strokeDasharray="4 4" label={{ value: refY.label, position: "insideTopLeft", fill: "var(--axis)", fontSize: 11 }} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }} strokeDasharray={s.dashed ? "5 4" : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

export function Bars({ data, xKey, series, height = 260, stacked, xFmt, valueFmt }: { data: any[]; xKey: string; series: Serie[]; height?: number; stacked?: boolean; xFmt?: (v: any) => string; valueFmt?: (v: number) => string }) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xFmt} {...axisProps} />
          <YAxis tickFormatter={compactMoney} width={72} {...axisProps} />
          <Tooltip content={<Tip labelFmt={xFmt} valueFmt={valueFmt} total={stacked} />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? "a" : undefined} radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]} stroke={stacked ? "hsl(var(--card))" : undefined} strokeWidth={stacked ? 1 : 0} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export function Donut({ data, height = 220, valueFmt = (v: number) => money(v, false), center }: { data: { name: string; value: number; color: string }[]; height?: number; valueFmt?: (v: number) => string; center?: { label: string; value: string } }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={data.length > 1 ? 2 : 0} stroke="hsl(var(--card))" strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }: any) =>
              active && payload?.length ? (
                <div className="rounded-md border bg-card p-2 text-xs shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: payload[0].payload.color }} />
                    {payload[0].name}
                  </div>
                  <div className="tabular mt-0.5 font-medium">
                    {valueFmt(payload[0].value)} · {total ? ((payload[0].value / total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">{center.label}</span>
          <span className="tabular text-lg font-semibold">{center.value}</span>
        </div>
      )}
    </div>
  );
}

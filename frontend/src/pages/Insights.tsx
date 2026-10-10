import { ErrorBox, Loading, PageHeader, Recommendations } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { useGet } from "@/hooks/useApi";
import type { Recommendation } from "@/lib/types";

export default function Insights() {
  const { data, isLoading, error } = useGet<Recommendation[]>("/recommendations");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  return (
    <>
      <PageHeader title="Alertas y recomendaciones" description="Generadas automáticamente: presupuestos, gasto excesivo, tendencia del ahorro, efectivo ocioso, amortización de hipoteca y objetivos." />
      <Card><CardContent className="pt-5"><Recommendations items={data} /></CardContent></Card>
    </>
  );
}

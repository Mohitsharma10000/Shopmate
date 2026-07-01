import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { aiInsights } from "@/lib/analytics.functions";

export function AiInsightsCard({ shopId }: { shopId: string }) {
  const fn = useServerFn(aiInsights);
  const [text, setText] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () => fn({ data: { shop_id: shopId } }),
    onSuccess: (d: any) => {
      setText(d.text);
      setGeneratedAt(d.generated_at);
    },
    onError: (e: any) => toast.error(e?.message || "AI failed"),
  });

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Business Insights
        </CardTitle>
        <Button
          size="sm"
          variant={text ? "ghost" : "default"}
          onClick={() => run.mutate()}
          disabled={run.isPending}
        >
          {run.isPending ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </>
          ) : text ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> Generate
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!text ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            <Sparkles className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            Get a smart briefing on today's sales, reorder suggestions, and
            dead stock alerts.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="prose prose-sm dark:prose-invert max-w-none [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_ul]:my-1 [&_p]:my-1 [&_li]:text-sm">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
            {generatedAt && (
              <div className="text-[10px] text-muted-foreground pt-1">
                Generated {new Date(generatedAt).toLocaleString("en-IN")}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

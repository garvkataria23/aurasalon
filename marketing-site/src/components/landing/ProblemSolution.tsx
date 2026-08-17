"use client";

import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  AlertTriangle, Clock, CreditCard, FileText, Users, Package,
  Zap, Calendar, BarChart3, Shield, Bot, Smartphone,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

const problems = [
  { icon: FileText, text: "problem.p1" }, { icon: Clock, text: "problem.p2" }, { icon: CreditCard, text: "problem.p3" },
  { icon: Users, text: "problem.p4" }, { icon: Package, text: "problem.p5" }, { icon: AlertTriangle, text: "problem.p6" },
];

const solutions = [
  { icon: Zap, text: "problem.s1" }, { icon: Calendar, text: "problem.s2" }, { icon: BarChart3, text: "problem.s3" },
  { icon: Shield, text: "problem.s4" }, { icon: Bot, text: "problem.s5" }, { icon: Smartphone, text: "problem.s6" },
];

function ProblemItem({ item }: { item: typeof problems[number] }) {
  const { t } = useLanguage();
  return (
    <div className="group flex min-h-16 items-center gap-4 border-b border-aura-border/70 py-3 transition-all duration-300 hover:translate-x-1">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center group-hover:bg-danger/15 group-hover:scale-110 transition-all duration-300">
        <item.icon className="w-5 h-5 text-danger" />
      </div>
      <span className="text-sm font-medium text-aura-text-secondary">{t(item.text)}</span>
    </div>
  );
}

function SolutionItem({ item }: { item: typeof solutions[number] }) {
  const { t } = useLanguage();
  return (
    <div className="group flex min-h-16 items-center gap-4 border-b border-aura-border/50 py-3 transition-all duration-300 hover:translate-x-1">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-aura-primary/10 flex items-center justify-center group-hover:bg-aura-primary/15 group-hover:scale-110 transition-all duration-300">
        <item.icon className="w-5 h-5 text-aura-primary" />
      </div>
      <span className="text-sm font-medium text-aura-text-secondary">{t(item.text)}</span>
    </div>
  );
}

export function ProblemSolution() {
  const { t } = useLanguage();

  return (
    <section className="py-20 md:py-32 bg-aura-surface">
      <Container>
        <SectionHeading
          badge={t("problem.badge")}
          title={t("problem.title")}
          subtitle={t("problem.subtitle")}
          align="left"
        />

        <div className="mt-14 grid overflow-hidden rounded-[1.75rem] border border-aura-border md:grid-cols-2 max-w-6xl">
          <div className="bg-white p-6 sm:p-8 lg:p-10">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-danger/10 text-danger mb-3">
                {t("problem.old")}
              </span>
              <h3 className="font-display text-3xl font-normal text-aura-text">{t("problem.oldTitle")}</h3>
            </div>
            <div className="space-y-3">
              {problems.map((item) => (
                <ProblemItem key={item.text} item={item} />
              ))}
            </div>
          </div>

          <div className="bg-aura-primary/5 p-6 sm:p-8 lg:p-10">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-aura-primary/10 text-aura-primary mb-3">
                {t("problem.new")}
              </span>
              <h3 className="font-display text-3xl font-normal text-aura-text">{t("problem.newTitle")}</h3>
            </div>
            <div className="space-y-3">
              {solutions.map((item) => (
                <SolutionItem key={item.text} item={item} />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

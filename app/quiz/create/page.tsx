import QuizCreate from "@/components/quiz/quiz-create";

export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.edit;
  const editId = typeof raw === "string" ? raw : null;
  return <QuizCreate editId={editId} />;
}

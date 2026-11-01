import { Brief, EventData } from "../shared/schema";
export const initialBrief: Brief = {
  name: "Ananya & Aarav’s wedding",
  type: "Wedding",
  date: "2027-02-14",
  location: "Jaipur, Rajasthan",
  guests: 120,
  budget: 800000,
  currency: "INR",
  preferences:
    "An intimate garden celebration. Terracotta, seasonal flowers, thoughtful local food, and a little starlight. Include vegetarian options and accessible seating.",
};
export function demoEvent(brief: Brief = initialBrief): EventData {
  const wedding = brief.type === "Wedding";
  const offset = (days: number) => {
    const d = new Date(brief.date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  return {
    brief,
    source: "demo",
    updatedAt: Date.now(),
    plan: {
      summary: `A ${brief.type.toLowerCase()} full of warmth, thoughtful details, and room to connect. Bring ${brief.guests} people together in ${brief.location} with seasonal touches and a relaxed, welcoming flow.`,
      budget: [
        "Venue & rentals",
        "Food & drinks",
        "Décor & flowers",
        "Photography",
        "Entertainment",
        "A little buffer",
      ].map((category, i) => ({
        id: "b" + i,
        category,
        amount: Math.floor(brief.budget * [0.3, 0.3, 0.15, 0.1, 0.05, 0.1][i]),
        spent: 0,
      })),
      tasks: [
        {
          id: "t1",
          title: "Find a venue that feels like you",
          due: offset(80),
          category: "Venue",
          done: false,
        },
        {
          id: "t2",
          title: "Build your guest list",
          due: offset(70),
          category: "Guests",
          done: false,
        },
        {
          id: "t3",
          title: "Book a seasonal tasting",
          due: offset(55),
          category: "Food",
          done: false,
        },
        {
          id: "t4",
          title: "Send invitations & collect access needs",
          due: offset(40),
          category: "Guests",
          done: false,
        },
        {
          id: "t5",
          title: "Confirm vendors and arrival times",
          due: offset(14),
          category: "Vendors",
          done: false,
        },
        {
          id: "t6",
          title: "Walk through your day-of timeline",
          due: offset(3),
          category: "Planning",
          done: false,
        },
      ],
      vendors: [
        "Venue",
        "Catering",
        "Florist",
        "Photographer",
        "Music & sound",
      ].map((category, i) => ({
        id: "v" + i,
        category,
        notes:
          "Ask for an itemized quote, cancellation terms, availability, and accessibility arrangements.",
        status: "To research",
      })),
      ideas: [
        {
          title: wedding
            ? "Your story, in little details"
            : "A welcome with a personal touch",
          description: wedding
            ? "Turn your favorite memories into handwritten table names. Add a tiny story to each place setting."
            : "Invite guests to add a memory or a wish to a shared celebration wall.",
        },
        {
          title: "Locally grown, lovingly gathered",
          description:
            "Choose seasonal marigolds, reusable linens, and a menu inspired by local favorites. Donate surplus food with a local partner.",
        },
        {
          title: "A little magic after sunset",
          description:
            "Create a cozy corner with warm lanterns, soft acoustic music, and comfortable seating for every generation.",
        },
      ],
    },
  };
}

"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";

import {
  Users,
  BookOpen,
  MessageSquare,
  Star,
  CheckCircle,
  Globe,
  Clock,
  Heart,
  Feather,
  Smile,
  Info,
  Mail,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

export default function GuestLanding() {
  // Container fade + slight up motion
  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
  };

  // Feature card motion (scale up)
  const featureVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
  };

  // Testimonial fade-in scale
  const testimonialVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  // FAQ accordion motion
  const faqVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.15 } },
  };

  // Sample FAQ items
  const faqs = [
    {
      question: "Is CollabCampus free to use?",
      answer:
        "Yes! CollabCampus is completely free to join and use, empowering students worldwide to collaborate and share knowledge.",
    },
    {
      question: "How do I join groups or communities?",
      answer:
        "Simply create an account or log in, browse communities, and join with a single click to start collaborating instantly.",
    },
    {
      question: "Can I contribute articles or ask questions?",
      answer:
        "Absolutely! You can write articles, ask questions, and engage with fellow students across all subjects.",
    },
  ];

  // Sample testimonials
  const testimonials = [
    {
      name: "Alice G.",
      role: "Computer Science Student",
      avatarUrl: "",
      quote:
        "CollabCampus helped me connect with peers and get instant help on difficult programming problems. An amazing community!",
    },
    {
      name: "Raj M.",
      role: "Engineering Graduate",
      avatarUrl: "",
      quote:
        "The quality articles and study groups here significantly boosted my academic performance and confidence.",
    },
    {
      name: "Sophia L.",
      role: "Business School Student",
      avatarUrl: "",
      quote:
        "I love how supportive the community is! Asking questions and sharing knowledge feels seamless and rewarding.",
    },
  ];

  return (
    <main className="relative bg-gradient-to-br from-indigo-50 to-indigo-200 dark:from-indigo-900 dark:to-indigo-700 min-h-screen px-6 py-12 text-center text-gray-900 dark:text-gray-200 overflow-hidden">
      {/* Background animated blur spots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
        className="pointer-events-none absolute top-[-100px] right-[-100px] w-[250px] h-[250px] rounded-full bg-indigo-400 dark:bg-indigo-800 blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.12 }}
        transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
        className="pointer-events-none absolute bottom-[-80px] left-[-80px] w-[200px] h-[200px] rounded-full bg-indigo-600 dark:bg-indigo-700 blur-3xl"
      />

      {/* Hero / Welcome */}
      <motion.section
        className="relative max-w-3xl mx-auto mb-20"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400 dark:from-indigo-300 dark:to-indigo-600 mb-6">
          Welcome to <br />
          <span className="italic">CollabCampus</span>
        </h1>
        <p className="text-lg sm:text-xl font-light max-w-xl mx-auto text-gray-700 dark:text-gray-300 mb-8">
          Empower your academic journey through student collaboration, real-time knowledge sharing, and mentorship.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-5">
          <Button asChild size="lg" className="shadow-lg">
            <Link href="/auth/sign-up" className="flex items-center gap-2">
              Join the Community <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/blogs">Explore Content</Link>
          </Button>
        </div>
      </motion.section>

      {/* Features */}
      <motion.section
        className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 mb-24"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {[
          {
            icon: <Users className="w-14 h-14 text-indigo-600 dark:text-indigo-400" />,
            title: "Connect with Students",
            desc: "Join a vibrant community collaborating on projects, assignments, and ideas.",
          },
          {
            icon: <BookOpen className="w-14 h-14 text-indigo-600 dark:text-indigo-400" />,
            title: "Access Quality Content",
            desc: "Explore articles, tutorials, and study resources created by peers and experts.",
          },
          {
            icon: <MessageSquare className="w-14 h-14 text-indigo-600 dark:text-indigo-400" />,
            title: "Ask & Answer Questions",
            desc: "Get help when you’re stuck and support others by sharing your knowledge.",
          },
          {
            icon: <Star className="w-14 h-14 text-indigo-600 dark:text-indigo-400" />,
            title: "Follow Top Contributors",
            desc: "Learn from experienced community members and watch content you love grow.",
          },
          {
            icon: <CheckCircle className="w-14 h-14 text-indigo-600 dark:text-indigo-400" />,
            title: "Verified & Trusted",
            desc: "Enjoy a secure platform vetted for academic collaboration and quality content.",
          },
          {
            icon: <Globe className="w-14 h-14 text-indigo-600 dark:text-indigo-400" />,
            title: "Global Community",
            desc: "Collaborate with students from around the world in a supportive environment.",
          },
        ].map(({ icon, title, desc }, i) => (
          <motion.div
            key={i}
            className="bg-white dark:bg-indigo-900 rounded-xl p-8 shadow-md flex flex-col items-center gap-6 cursor-default select-none"
            variants={featureVariants}
            whileHover={{ scale: 1.05 }}
            tabIndex={0}
            role="region"
            aria-label={title}
          >
            {icon}
            <h3 className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">{title}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-center">{desc}</p>
          </motion.div>
        ))}
      </motion.section>

      {/* Testimonials */}
      <motion.section
        className="max-w-4xl mx-auto mb-24 space-y-14 px-4"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <h2 className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 mb-12">
          What students say about CollabCampus
        </h2>
        <div className="grid gap-12 sm:grid-cols-3">
          {[
            {
              name: "Alice G.",
              role: "Computer Science Student",
              avatar: "",
              quote:
                "CollabCampus helped me connect with peers and get instant help on complex problems. An amazing community!",
            },
            {
              name: "Raj M.",
              role: "Engineering Graduate",
              avatar: "",
              quote:
                "The quality articles and study groups on the platform boosted my academic performance and confidence.",
            },
            {
              name: "Sophia L.",
              role: "Business School Student",
              avatar: "",
              quote:
                "I love the supportive community! Asking questions and sharing knowledge is so easy and rewarding.",
            },
          ].map(({ name, role, avatar, quote }, i) => (
            <motion.blockquote
              key={i}
              className="relative bg-indigo-100 dark:bg-indigo-800 rounded-xl p-6 text-gray-800 dark:text-gray-200 shadow flex flex-col justify-between"
              variants={testimonialVariants}
            >
              <p className="mb-6 text-lg font-semibold leading-relaxed">{quote}</p>
              <footer className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {avatar ? (
                    <img className="w-12 h-12 rounded-full object-cover" src={avatar} alt={name} />
                  ) : (
                    <div className="w-12 h-12 bg-indigo-400 rounded-full flex items-center justify-center font-semibold text-white text-xl uppercase select-none">
                      {name[0]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400">{role}</p>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </motion.section>

      {/* Call to Action - Invitation */}
      <motion.section
        className="max-w-3xl mx-auto bg-indigo-700 dark:bg-indigo-900 rounded-3xl px-10 py-16 text-white shadow-lg"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <h2 className="text-4xl font-extrabold mb-4 drop-shadow-md">
          Ready to join the community?
        </h2>
        <p className="text-lg mb-10 max-w-xl drop-shadow-md">
          Start collaborating, learning, and sharing knowledge with thousands of students worldwide.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <Button asChild size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-lg">
            <Link href="/auth/sign-up" className="flex items-center gap-2">
              Create an Account <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="shadow-inner">
            <Link href="/blogs">Explore Articles</Link>
          </Button>
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        className="max-w-4xl mx-auto my-20 px-4 text-left"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <h2 className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 mb-10 text-center">
          Frequently Asked Questions
        </h2>

        <div className="max-w-3xl mx-auto space-y-6">
          {faqs.map(({ question, answer }, idx) => (
            <motion.details
              key={idx}
              className="rounded-lg bg-white dark:bg-indigo-900 p-6 shadow-lg cursor-pointer group"
              variants={faqVariants}
            >
              <summary className="font-semibold text-lg text-indigo-700 dark:text-indigo-300 flex justify-between items-center list-none">
                {question}
                <span className="transition-transform duration-500 group-open:rotate-180">
                  <ChevronRight className="w-6 h-6" />
                </span>
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300">{answer}</p>
            </motion.details>
          ))}
        </div>
      </motion.section>

      {/* Footer Invite */}
      <motion.footer
        className="py-10 text-center text-gray-600 dark:text-gray-400 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 1 }}
      >
        <p>
          Have questions? <Link href="/contact" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">Contact us</Link> anytime.
        </p>
      </motion.footer>
    </main>
  );
}

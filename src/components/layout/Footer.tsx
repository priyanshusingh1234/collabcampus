import Link from 'next/link';
import { FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa';
import { Logo } from '@/components/branding/Logo';


export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-800 bg-[#161b22] text-gray-400 py-8 mt-12">
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center gap-4 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Logo className="w-6 h-6" variant="outline" />
          <span className="font-semibold text-base text-gray-200">Manthan</span>
        </div>
  <nav className="flex flex-col items-center gap-2 text-sm justify-center mb-2">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/blogs" className="hover:text-white transition-colors">Blogs</Link>
          <Link href="/groups" className="hover:text-white transition-colors">Groups</Link>
          <Link href="/questions" className="hover:text-white transition-colors">Questions</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </nav>
        <div className="flex gap-5 mt-2">
          <a href="https://github.com/" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-white transition-colors">
            <FaGithub className="w-5 h-5" />
          </a>
          <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="hover:text-white transition-colors">
            <FaTwitter className="w-5 h-5" />
          </a>
          <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-white transition-colors">
            <FaLinkedin className="w-5 h-5" />
          </a>
        </div>
        <div className="w-full border-t border-gray-700 mt-6"></div>
        <div className="text-xs text-center w-full pt-4 text-gray-500">
          &copy; {new Date().getFullYear()} Manthan. Built by students, for students.
        </div>
      </div>
    </footer>
  );
}

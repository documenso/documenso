'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Variants, motion } from 'framer-motion';
import { usePlausible } from 'next-plausible';
import { LuGithub } from 'react-icons/lu';
import { match } from 'ts-pattern';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import backgroundPattern from '~/assets/background-pattern.png';

import { Widget } from './widget';

export type HeroProps = {
  className?: string;
  [key: string]: unknown;
};

const BackgroundPatternVariants: Variants = {
  initial: {
    opacity: 0,
  },

  animate: {
    opacity: 1,

    transition: {
      delay: 1,
      duration: 1.2,
    },
  },
};

const HeroTitleVariants: Variants = {
  initial: {
    opacity: 0,
    y: 60,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export const Hero = ({ className, ...props }: HeroProps) => {
  const event = usePlausible();

  const { getFlag } = useFeatureFlags();

  const heroMarketingCTA = getFlag('marketing_landing_hero_cta');

  const onSignUpClick = () => {
    const el = document.getElementById('email');

    if (el) {
      const { top } = el.getBoundingClientRect();

      window.scrollTo({
        top: top - 120,
        behavior: 'smooth',
      });

      requestAnimationFrame(() => {
        el.focus();
      });
    }
  };

  return (
    <motion.div className={cn('relative', className)} {...props}>
      <div className="absolute -inset-24 -z-10">
        <motion.div
          className="flex h-full w-full origin-top-right items-center justify-center"
          variants={BackgroundPatternVariants}
          initial="initial"
          animate="animate"
        >
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="-mr-[50vw] -mt-[15vh] h-full scale-125 object-cover dark:contrast-[70%] dark:invert dark:sepia md:scale-150 lg:scale-[175%]"
          />
        </motion.div>
      </div>

      <div className="relative">
        <motion.h2
          variants={HeroTitleVariants}
          initial="initial"
          animate="animate"
          className="text-center text-4xl font-bold leading-tight tracking-tight lg:text-[64px]"
        >
          Document signing,
          <span className="block" /> finally open source.
        </motion.h2>

        <motion.div
          variants={HeroTitleVariants}
          initial="initial"
          animate="animate"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4"
        >
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-transparent backdrop-blur-sm"
            onClick={onSignUpClick}
          >
            Get the Early Adopters Plan
            <span className="bg-primary dark:text-background -mr-2.5 ml-2.5 rounded-full px-2 py-1.5 text-xs">
              $30/mo. forever!
            </span>
          </Button>

          <Link href="https://github.com/documenso/documenso" onClick={() => event('view-github')}>
            <Button variant="outline" className="rounded-full bg-transparent backdrop-blur-sm">
              <LuGithub className="mr-2 h-5 w-5" />
              Star on Github
            </Button>
          </Link>
        </motion.div>

        {match(heroMarketingCTA)
          .with('spm', () => (
            <motion.div
              variants={HeroTitleVariants}
              initial="initial"
              animate="animate"
              className="border-primary bg-background hover:bg-muted mx-auto mt-8 w-60 rounded-xl border transition-colors duration-300"
            >
              <Link href="/singleplayer" className="block px-4 py-2 text-center">
                <h2 className="text-muted-foreground text-xs font-semibold">
                  Introducing Single Player Mode
                </h2>

                <h1 className="text-foreground mt-1.5 font-medium leading-5">
                  Self sign for free!
                </h1>
              </Link>
            </motion.div>
          ))
          .with('productHunt', () => (
            <motion.div
              variants={HeroTitleVariants}
              initial="initial"
              animate="animate"
              className="mt-8 flex flex-col items-center justify-center gap-x-6 gap-y-4"
            >
              <Link
                href="https://www.producthunt.com/posts/documenso?utm_source=badge-top-post-badge&utm_medium=badge&utm_souce=badge-documenso"
                target="_blank"
              >
                <img
                  src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=395047&theme=light&period=daily"
                  alt="Documenso - The open source DocuSign alternative | Product Hunt"
                  style={{ width: '250px', height: '54px' }}
                />
              </Link>
            </motion.div>
          ))
          .otherwise(() => null)}

        <motion.div
          className="mt-12"
          variants={{
            initial: {
              scale: 0.2,
              opacity: 0,
            },
            animate: {
              scale: 1,
              opacity: 1,
              transition: {
                ease: 'easeInOut',
                delay: 0.5,
                duration: 0.8,
              },
            },
          }}
          initial="initial"
          animate="animate"
        >
          <Widget className="mt-12">
            <strong>Documenso Supporter Pledge</strong>
            <p className="w-full max-w-[70ch]">
              Our mission is to create an open signing infrastructure that empowers the world,
              enabling businesses to embrace openness, cooperation, and transparency. We believe
              that signing, as a fundamental act, should embody these values. By offering an
              open-source signing solution, we aim to make document signing accessible, transparent,
              and trustworthy.
            </p>

            <p className="w-full max-w-[70ch]">
              Through our platform, called Documenso, we strive to earn your trust by allowing
              self-hosting and providing complete visibility into its inner workings. We value
              inclusivity and foster an environment where diverse perspectives and contributions are
              welcomed, even though we may not implement them all.
            </p>

            <p className="w-full max-w-[70ch]">
              At Documenso, we envision a web-enabled future for business and contracts, and we are
              committed to being the leading provider of open signing infrastructure. By combining
              exceptional product design with open-source principles, we aim to deliver a robust and
              well-designed application that exceeds your expectations.
            </p>

            <p className="w-full max-w-[70ch]">
              We understand that exceptional products are born from exceptional communities, and we
              invite you to join our open-source community. Your contributions, whether technical or
              non-technical, will help shape the future of signing. Together, we can create a better
              future for everyone.
            </p>

            <p className="w-full max-w-[70ch]">
              Today we invite you to join us on this journey: By signing this mission statement you
              signal your support of Documenso's mission{' '}
              <span className="bg-primary text-black">
                (in a non-legally binding, but heartfelt way)
              </span>{' '}
              and lock in the early supporter plan for forever, including everything we build this
              year.
            </p>

            <div className="flex h-24 items-center">
              <p className={cn('text-5xl [font-family:var(--font-caveat)]')}>Timur & Lucas</p>
            </div>

            <div>
              <strong>Timur Ercan & Lucas Smith</strong>
              <p className="mt-1">Co-Founders, Documenso</p>
            </div>
          </Widget>
        </motion.div>
      </div>
    </motion.div>
  );
};

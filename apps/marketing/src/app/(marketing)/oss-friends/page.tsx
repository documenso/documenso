'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Variants, motion } from 'framer-motion';

import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardTitle } from '@documenso/ui/primitives/card';

import backgroundPattern from '~/assets/background-pattern.png';

const OSSFriends = [
  {
    name: 'BoxyHQ',
    description:
      'BoxyHQ’s suite of APIs for security and privacy helps engineering teams build and ship compliant cloud applications faster.',
    href: 'https://boxyhq.com',
  },
  {
    name: 'Cal.com',
    description:
      'Cal.com is a scheduling tool that helps you schedule meetings without the back-and-forth emails.',
    href: 'https://cal.com',
  },
  {
    name: 'Crowd.dev',
    description:
      'Centralize community, product, and customer data to understand which companies are engaging with your open source project.',
    href: 'https://www.crowd.dev',
  },
  {
    name: 'Documenso',
    description:
      'The Open-Source DocuSign Alternative. We aim to earn your trust by enabling you to self-host the platform and examine its inner workings.',
    href: 'https://documenso.com',
  },
  {
    name: 'Erxes',
    description:
      'The Open-Source HubSpot Alternative. A single XOS enables to create unique and life-changing experiences ​​that work for all types of business.',
    href: 'https://erxes.io',
  },
  {
    name: 'Formbricks',
    description:
      'Survey granular user segments at any point in the user journey. Gather up to 6x more insights with targeted micro-surveys. All open-source.',
    href: 'https://formbricks.com',
  },
  {
    name: 'Forward Email',
    description:
      'Free email forwarding for custom domains. For 6 years and counting, we are the go-to email service for thousands of creators, developers, and businesses.',
    href: 'https://forwardemail.net',
  },
  {
    name: 'GitWonk',
    description:
      'GitWonk is an open-source technical documentation tool, designed and built focusing on the developer experience.',
    href: 'https://gitwonk.com',
  },
  {
    name: 'Hanko',
    description:
      'Open-source authentication and user management for the passkey era. Integrated in minutes, for web and mobile apps.',
    href: 'https://www.hanko.io',
  },
  {
    name: 'HTMX',
    description:
      'HTMX is a dependency-free JavaScript library that allows you to access AJAX, CSS Transitions, WebSockets, and Server Sent Events directly in HTML.',
    href: 'https://htmx.org',
  },
  {
    name: 'Infisical',
    description:
      'Open source, end-to-end encrypted platform that lets you securely manage secrets and configs across your team, devices, and infrastructure.',
    href: 'https://infisical.com',
  },
  {
    name: 'Novu',
    description:
      'The open-source notification infrastructure for developers. Simple components and APIs for managing all communication channels in one place.',
    href: 'https://novu.co',
  },
  {
    name: 'OpenBB',
    description:
      'Democratizing investment research through an open source financial ecosystem. The OpenBB Terminal allows everyone to perform investment research, from everywhere.',
    href: 'https://openbb.co',
  },
  {
    name: 'Sniffnet',
    description:
      'Sniffnet is a network monitoring tool to help you easily keep track of your Internet traffic.',
    href: 'https://www.sniffnet.net',
  },
  {
    name: 'Typebot',
    description:
      'Typebot gives you powerful blocks to create unique chat experiences. Embed them anywhere on your apps and start collecting results like magic.',
    href: 'https://typebot.io',
  },
  {
    name: 'Webiny',
    description:
      'Open-source enterprise-grade serverless CMS. Own your data. Scale effortlessly. Customize everything.',
    href: 'https://www.webiny.com',
  },
  {
    name: 'Webstudio',
    description: 'Webstudio is an open source alternative to Webflow',
    href: 'https://webstudio.is',
  },
];

const ContainerVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.075,
    },
  },
};

const CardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 50,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

const randomDegrees = () => {
  const degrees = [45, 120, -140, -45];

  return degrees[Math.floor(Math.random() * degrees.length)];
};

export default function OSSFriendsPage() {
  return (
    <div className="relative mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">
          Our <span title="Open Source Software">OSS</span> Friends
        </h1>

        <p className="mx-auto mt-4 max-w-[55ch] text-lg leading-normal text-[#31373D]">
          We love open source and so should you, below you can find a list of our friends who are
          just as passionate about open source as we are.
        </p>
      </div>

      <motion.div
        className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
        variants={ContainerVariants}
        initial="initial"
        animate="animate"
      >
        {OSSFriends.map((friend, index) => (
          <motion.div key={index} className="h-full w-full" variants={CardVariants}>
            <Card
              className="h-full"
              degrees={randomDegrees()}
              gradient={index % 2 === 0}
              spotlight={index % 2 !== 0}
            >
              <CardContent className="flex h-full flex-col p-6">
                <CardTitle>
                  <Link href={friend.href}>{friend.name}</Link>
                </CardTitle>

                <p className="mt-4 flex-1 text-sm text-slate-700">{friend.description}</p>

                <div className="mt-8">
                  <Link target="_blank" href={friend.href}>
                    <Button>Learn more</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="absolute inset-0 -z-10 flex items-start justify-center">
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="-mr-[15vw] -mt-[15vh] h-full max-h-[150vh] scale-125 object-cover md:-mr-[50vw] md:scale-150 lg:scale-[175%]"
        />
      </div>
    </div>
  );
}

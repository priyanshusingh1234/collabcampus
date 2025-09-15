"use client"
import React from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { ogTags, articleJsonLd, profileJsonLd, type BasicSeo, buildTitle, canonical } from '@/lib/seo'

export type SeoClientProps = BasicSeo & {
  jsonLd?: 'article' | 'profile' | 'none'
  extraMeta?: Array<{ name?: string; property?: string; content: string }>
}

export function SeoClient(props: SeoClientProps) {
  const title = buildTitle(props.title)
  const tags = ogTags(props)
  const jsonType = props.jsonLd || 'none'
  const json = jsonType === 'article' ? articleJsonLd(props) : jsonType === 'profile' ? profileJsonLd(props as any) : null
  const url = canonical(props.url)

  return (
    <>
      <Head>
        <title>{title}</title>
        <link rel="canonical" href={url} />
        {tags.map((t, i) => (
          t.property ? (
            <meta key={i} property={t.property} content={t.content} />
          ) : (
            <meta key={i} name={(t as any).name} content={t.content} />
          )
        ))}
        {props.extraMeta?.map((t, i) => (
          t.property ? (
            <meta key={`x-${i}`} property={t.property} content={t.content} />
          ) : (
            <meta key={`x-${i}`} name={t.name} content={t.content} />
          )
        ))}
      </Head>
      {json ? (
        <Script id="jsonld-seo" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify(json)}
        </Script>
      ) : null}
    </>
  )
}

export default SeoClient

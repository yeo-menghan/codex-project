import Head from "next/head";
import PaperCarousel from "../components/PaperCarousel";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>PaperWaifu Carousel</title>
        <meta
          name="description"
          content="TikTok-style vertical research paper browser with talking avatars"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <PaperCarousel />
    </>
  );
}

import { toggleAskKen } from "../askKenService";
import { isReflectionTabOpened } from "@packages/discover-extension/ext_discover/host/extraServices";
interface AskKenChatProps {
  isMobile: boolean;
}

const AskKenLogo = () => {
  const imageSrc =
    "https://res.cloudinary.com/dpudrufae/image/upload/v1769591647/kenboa_clean_circle_b9zmpr.png";

  return (
    <div
      style={{
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        width: "58px",
        height: "58px",
        borderRadius: "100%",
        border: "0.5px solid var(--sb-secondary-font-color, #fff)",
        background: "var(--sb-background, #fff)",
        color: "var(--sb-secondary-font-color, #fff)",
        gap: "3px",
      }}
    >
      <img
        src={imageSrc}
        alt="askKen"
        style={{
          width: "42px",
          height: "42px",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
};

export const AskKenChat = ({ isMobile }: AskKenChatProps) => {
  const isReflection = isReflectionTabOpened.value;

  return (
    <div
      onClick={toggleAskKen}
      style={
        isReflection
          ? {
              position: "fixed",
              bottom: isMobile ? "69px" : "40px",
              right: isMobile ? "14px" : "6px",
              zIndex: 999,

              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "135px",

              padding: "12px",
              minWidth: "90px",
              minHeight: "85px",
              borderRadius: "4px",

              background: "#2E4879",

              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              gap: "4px",
            }
          : undefined
      }
    >
      {isReflection ? (
        <>
          <AskKenLogo />

          <span
            style={{
              color: "#fff",
              fontSize: "15px",
            }}
          >
            Ask Ken!
          </span>
        </>
      ) : (
        <>
          <div
            className="askKen-text"
            style={{
              position: "fixed",
              bottom: isMobile ? "138px" : "107px",
              right: "14px",
              color: "var(--sb-background, #fff)",
              zIndex: 999,
              padding: "8px 18px",
              fontSize: "15px",
              borderRadius: "25px",
              textAlign: "center",
              background: "var(--sb-primary-color, #fff)",
            }}
          >
            Ask Ken!
          </div>

          <div
            style={{
              position: "fixed",
              bottom: isMobile ? "75px" : "43px",
              right: "7px",
              zIndex: 999,
              background: "var(--sb-background, #fff)",
            }}
          >
            <AskKenLogo />
          </div>
        </>
      )}
    </div>
  );
};

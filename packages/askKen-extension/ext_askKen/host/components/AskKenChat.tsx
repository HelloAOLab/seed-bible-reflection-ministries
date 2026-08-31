import { toggleAskKen } from "../askKenService";
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
        border: "0.5px solid var(--sb-secondary-font-color, #fff) ",
        background: "var(--sb-background, #fff)",
        color: "var(--sb-secondary-font-color, #fff)",
        gap: "3px",
      }}
    >
      <img
        src={imageSrc}
        alt="askKen"
        style={{
          width: "42px", // Adjust as needed
          height: "42px",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
};

export const AskKenChat = ({ isMobile }: AskKenChatProps) => {
  return (
    <div>
      <div onClick={toggleAskKen}>
        <div
          className="askKen-text"
          style={{
            position: "fixed",
            bottom: isMobile ? "140px" : "102px",
            right: "14px",
            color: "var(--sb-background, #fff)",
            zIndex: "999",
            padding: "8px 18px 8px 18px",
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
            color: "var(--sb-secondary-font-color, #fff)",
            zIndex: "999",
            background: "var(--sb-background, #fff)",
          }}
        >
          <AskKenLogo />
        </div>
      </div>
    </div>
  );
};

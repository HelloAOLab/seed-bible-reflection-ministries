import { toggleAskKen } from "../askKenService";
interface AskKenChatProps {
  theme: string;
}
const AskKenLogo = ({ theme }: AskKenChatProps) => {
  const imageSrc =
    theme === "dark"
      ? "https://res.cloudinary.com/dpudrufae/image/upload/v1784021130/ChatGPT_Image_Jul_14_2026_02_54_47_PM_japkbz.png"
      : "https://res.cloudinary.com/dpudrufae/image/upload/v1769591647/kenboa_clean_circle_b9zmpr.png";
  return (
    <div
      style={{
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        width: "52px",
        height: "52px",
        borderRadius: "60px",
        border: "0.5px solid black",
        background: "var(--sb-background, #fff)",
        color: "var(--sb-secondary-font-color, #fff)",
        gap: "3px",
      }}
    >
      <img
        src={imageSrc}
        alt="askKen"
        style={{
          width: "54px", // Adjust as needed
          height: "54px",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
};

export const AskKenChat = ({ theme }: AskKenChatProps) => {
  return (
    <div>
      <div onClick={toggleAskKen}>
        <div
          className="askKen-text"
          style={{
            position: "fixed",
            bottom: "100px",
            right: "5px",
            color: "black",
            zIndex: "999",
            padding: "6px 16px 6px 16px",
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
            bottom: "45px",
            right: "7px",
            color: "var(--sb-secondary-font-color, #fff)",
            zIndex: "999",
            background: "var(--sb-background, #fff)",
          }}
        >
          <div
            style={{
              alignItems: "center",
              justifyContent: "center",
              display: "flex",
              width: "52px",
              height: "52px",
              borderRadius: "60px",
              border: "1px solid black",
              background: "var(--sb-background, #fff)",
              color: "var(--sb-secondary-font-color, #fff)",
              gap: "3px",
            }}
          >
            <AskKenLogo theme={theme} />
          </div>
        </div>
      </div>
    </div>
  );
};

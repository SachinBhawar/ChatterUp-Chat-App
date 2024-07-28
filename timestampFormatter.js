import moment from "moment";

const formatDateToIST = (utcTimestamp) => {
  // Step 1: Parse the UTC timestamp
  let utcDate = new Date(utcTimestamp);

  // Step 2: Adjust to IST
  let istOffset = 0; // IST is UTC + 5:30
  let istDate = new Date(utcDate.getTime() + istOffset * 60 * 1000);

  // Step 3: Format the date and time
  let formattedDate;
  let now = new Date();
  let today = now.toISOString().split("T")[0];
  let yesterday = new Date(now.setDate(now.getDate() - 1)).toISOString().split("T")[0];

  if (istDate.toISOString().split("T")[0] === today) {
    formattedDate = `Today, ${formatTime(istDate)}`;
  } else if (istDate.toISOString().split("T")[0] === yesterday) {
    formattedDate = `Yesterday, ${formatTime(istDate)}`;
  } else {
    formattedDate = `${formatDate(istDate)}, ${formatTime(istDate)}`;
  }

  return formattedDate;
};

// Helper function to format time
function formatTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let ampm = hours >= 12 ? "pm" : "am";
  hours %= 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  let strTime = hours + ":" + (minutes < 10 ? "0" + minutes : minutes) + " " + ampm;
  return strTime;
}

// Helper function to format date
function formatDate(date) {
  let day = date.getDate();
  let monthNo = date.getMonth(); // January is 0!
  let month = {
    0: "Jan",
    1: "Feb",
    2: "Mar",
    3: "Apr",
    4: "May",
    5: "Jun",
    6: "Jul",
    7: "Aug",
    8: "Sep",
    9: "Oct",
    10: "Nov",
    11: "Dec",
  };
  let year = date.getFullYear();

  return `${day} ${month[monthNo]}, ${year}`;
}

export default formatDateToIST;

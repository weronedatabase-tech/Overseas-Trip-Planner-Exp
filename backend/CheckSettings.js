function checkSettings() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty("app_settings");
  console.log(saved);
}

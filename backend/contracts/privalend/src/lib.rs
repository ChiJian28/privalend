wit_bindgen::generate!({
    world: "privalend",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

mod eligibility;
mod offers;
mod application;

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::privalend::contracts::Guest for Component {
    fn assess_eligibility(req: exports::z::privalend::contracts::GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("assess-eligibility: missing input")?;
        eligibility::assess_eligibility(&input)
    }

    fn fetch_offers(req: exports::z::privalend::contracts::GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("fetch-offers: missing input")?;
        offers::fetch_offers(&input)
    }

    fn submit_application(req: exports::z::privalend::contracts::GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("submit-application: missing input")?;
        application::submit_application(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

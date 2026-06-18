wit_bindgen::generate!({
    world: "fraud-consortium",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

mod blacklist;

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::fraud_consortium::contracts::Guest for Component {
    fn check_blacklist(req: exports::z::fraud_consortium::contracts::GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("check-blacklist: missing input")?;
        blacklist::check_blacklist(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

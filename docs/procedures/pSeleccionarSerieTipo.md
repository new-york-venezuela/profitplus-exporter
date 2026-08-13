# SP: pSeleccionarSerieTipo
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarSerieTipo
DESCRIPCION:	Obtiene los registros asociados a la tabla 
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSerieTipo]
    (
      @sCo_Tipo_Serie CHAR(6)
    )
AS 
    BEGIN

         SELECT
              st.*, CASE WHEN EXISTS (SELECT * FROM saSerieTipoExt stE) THEN st.prefijo ELSE null END AS co_serie,
			        CASE WHEN EXISTS (SELECT * FROM saSerieTipoExt stE) THEN (SELECT stE.fe_venc FROM saSerieTipoExt stE WHERE stE.rowguid_serietipo = st.rowguid) ELSE NULL END AS fe_venc,
					CASE WHEN EXISTS (SELECT * FROM saSerieTipoExt stE) THEN (SELECT stE.notidiavenc FROM saSerieTipoExt stE WHERE stE.rowguid_serietipo = st.rowguid) ELSE NULL END AS notidiavenc,
					CASE WHEN EXISTS (SELECT * FROM saSerieTipoExt stE) THEN (SELECT stE.notifinserie FROM saSerieTipoExt stE WHERE stE.rowguid_serietipo = st.rowguid) ELSE NULL END AS notifinserie,
					CASE WHEN EXISTS (SELECT * FROM saSerieTipoExt stE) THEN (SELECT stE.punto_emi FROM saSerieTipoExt stE WHERE stE.rowguid_serietipo = st.rowguid) ELSE NULL END AS punto_emi,
					CASE WHEN EXISTS (SELECT * FROM saSerieTipoExt stE) THEN (SELECT stE.area_imp FROM saSerieTipoExt stE WHERE stE.rowguid_serietipo = st.rowguid) ELSE NULL END AS area_imp,
					CASE WHEN EXISTS (SELECT * FROM saSerieTipoExt stE) THEN (SELECT stE.co_tipo FROM saSerieTipoExt stE WHERE stE.rowguid_serietipo = st.rowguid) ELSE NULL END AS co_tipo
        FROM
            dbo.saSerieTipo st 
        WHERE
            st.co_tipo_serie = @sCo_Tipo_Serie

    END
```

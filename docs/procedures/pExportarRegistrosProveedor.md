# SP: pExportarRegistrosProveedor
**Tipo**: Procedimiento
**Módulo**: Clientes

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosProveedor
*DESCRIPCIÓN	:	Inserta un Proveedor
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosProveedor]
    (
		@sCo_Prov                         CHAR(16) ,
		@sProv_des                  VARCHAR(100) ,
		@sCo_seg                          CHAR(6) ,
		@sCo_zon                          CHAR(6) ,
		@bInactivo                  BIT = 0 ,
		@sDirec1                          VARCHAR(MAX) = NULL ,
		@sDirec2                          VARCHAR(MAX) = NULL ,
		@sTelefonos                 VARCHAR(60) = NULL ,
		@sFax                             VARCHAR(60) = NULL ,
		@sRespons                         VARCHAR(60) = NULL ,
		@sdFecha_reg                SMALLDATETIME ,
		@sTip_Pro                         CHAR(6) ,
		@deMont_cre                 DECIMAL(18, 2) = 0 ,
		@sCo_Mone                         CHAR(6) = NULL ,
		@sCond_Pag                  CHAR(6) = NULL ,
		@iPlaz_pag                  INT = 0 ,
		@deDesc_ppago               DECIMAL(18, 2) = 0 ,
		@deDesc_Glob                DECIMAL(18, 2) = 0 ,
		@sRif                             VARCHAR(18) = NULL ,
		@bNacional                  BIT = 0 ,
		@sDis_cen                         VARCHAR(MAX) = NULL ,
		@sNit                             VARCHAR(18) = NULL ,
		@sEmail                     VARCHAR(60) = NULL ,
		@sCo_Cta_Ingr_Egr           CHAR(20) ,
		@sComentario                VARCHAR(MAX) = NULL ,
		@iTipo_Adi                  INT = 0 ,
		@sMatriz                          CHAR(16) = NULL ,
		@sCo_Tab                          CHAR(20) ,
		@sTipo_Per                  CHAR = NULL,
		@sCo_pais                         CHAR(6) = NULL ,
		@sCiudad                          VARCHAR(50) = NULL ,
		@sZip                             VARCHAR(10) = NULL ,
		@sWebSite                         VARCHAR(200) = NULL ,
		@sFormType                  CHAR(30) = NULL ,
		@sTaxid                     CHAR(20) = NULL ,
		@bContribu_E                BIT = 0 ,
		@bRete_Regis_Doc            BIT ,
		@dePorc_Esp                 DECIMAL(18, 2) = 0 ,
		@sCampo1                          VARCHAR(60) = NULL ,
		@sCampo2                          VARCHAR(60) = NULL ,
		@sCampo3                          VARCHAR(60) = NULL ,
		@sCampo4                          VARCHAR(60) = NULL ,
		@sCampo5
```

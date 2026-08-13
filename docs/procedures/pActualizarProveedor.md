# SP: pActualizarProveedor
**Tipo**: Actualizar
**Módulo**: Clientes

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarProveedor
*DESCRIPCIÓN	: Actualiza un Proveedor
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarProveedor]
    (
      @sCo_Prov CHAR(16) ,
      @sCo_ProvOri CHAR(16) ,
      @sProv_des VARCHAR(100) ,
      @sCo_seg CHAR(6) ,
      @sCo_zon CHAR(6) ,
      @bInactivo BIT ,
      @sDirec1 VARCHAR(MAX) ,
      @sDirec2 VARCHAR(MAX) ,
      @sTelefonos VARCHAR(60) ,
      @sFax VARCHAR(60) ,
      @sRespons VARCHAR(60) ,
      @sdFecha_reg SMALLDATETIME ,
      @sTip_Pro CHAR(6) ,
      @deMont_cre DECIMAL(18, 2) ,
      @sCo_Mone CHAR(6) ,
      @sCond_Pag CHAR(6) ,
      @iPlaz_pag INT ,
      @deDesc_ppago DECIMAL(18, 2) ,
      @deDesc_Glob DECIMAL(18, 2) ,
      @sRif VARCHAR(18) = NULL ,
      @bNacional BIT ,
      @sDis_cen VARCHAR(MAX)= NULL ,
      @sNit VARCHAR(18) ,
      @sEmail VARCHAR(60) ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @sComentario VARCHAR(MAX) ,
      @iTipo_Adi INT ,
      @sMatriz CHAR(16) ,
      @sCo_Tab CHAR(20) ,
      @sTipo_Per CHAR(1) ,
      @sCo_pais CHAR(6) = NULL ,
      @sCiudad VARCHAR(50) ,
      @sZip VARCHAR(10) ,
      @sWebSite VARCHAR(200) ,
      @sFormType CHAR(30) ,
      @sTaxid CHAR(20) ,
      @bContribu_E BIT ,
      @bRete_Regis_Doc BIT ,
      @dePorc_Esp DECIMAL(18, 2) ,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL,
         @sTgasto CHAR(2) = NULL,
         @sTComp CHAR(2) = NULL,
         @sEmail_alterno VARCHAR(120) = NULL,
         @bSujeto_Obj_RetenISLR_Auto BIT = 0

    )
AS 
    BEGIN    
    
    -- MANEJO NCF
             DECLARE @bV_Manejo_ncf BIT

             SET @bV_Manejo_ncf = (SELECT v_maneja_ncf FROM par_emp)
             
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
```

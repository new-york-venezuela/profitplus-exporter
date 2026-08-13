# SP: pActualizarImpuestoMunicipal
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpMun`](../tables/saImpMun.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarImpuestoMunicipal
DESCRIPCION: Actualiza un Impuesto  Municipal
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarImpuestoMunicipal]
    (
      @sCo_Imun CHAR(15) ,
      @sCo_Sucur CHAR(6) ,
      @sCo_ImunOri CHAR(15) ,
      @sCo_SucurOri CHAR(6) ,
      @sImp_Des VARCHAR(60) ,
      @sN_Act CHAR(20) ,
      @deAlicuota DECIMAL(6, 2) ,
      @deM_Trib DECIMAL(18, 2) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		
	
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saImpMun
        SET co_imun = @sCo_Imun, co_sucur = @sCo_Sucur, imp_des = @sImp_Des, n_act = @sN_Act, alicuota = @deAlicuota,
            m_trib = @deM_Trib, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4,
            campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo,
            co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_imun = @sCo_ImunOri
            AND co_sucur = @sCo_SucurOri
            AND validador = @tsValidador

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
```

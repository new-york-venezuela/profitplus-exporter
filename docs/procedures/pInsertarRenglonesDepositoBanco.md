# SP: pInsertarRenglonesDepositoBanco
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pInsertarRenglonesDepositoBanco
DESCRIPCION	: Inserta un registro de la tabla saDepositoBancoReng
CREADO POR	: SOFTECH SISTEMAS
FECHA CREADO: 2018-07-26
FECHA MODIFICADO: 2019-09-30
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarRenglonesDepositoBanco]
    (
      @sDep_Num CHAR(20) ,
      @iReng_Num INT ,
      @sCodigo CHAR(6) ,
      @sMov_Afec_c CHAR(20) ,
      @sMov_Gene_c CHAR(20) ,
      @deMonto DECIMAL(18, 2) ,
      @deComision DECIMAL(18, 5) ,
      @deImpuesto DECIMAL(18, 5) ,
      @sTipo_Plazo CHAR(1) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL
	
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		DECLARE @sCo_Tar AS CHAR(20)
		DECLARE @sCo_Val AS CHAR(20)
		DECLARE @deMonto_Old DECIMAL(18, 2)
		DECLARE @iReng_Num_Old INT 
		DECLARE @sMov_Afec_c_Old CHAR(20)
			
		-- Actualizar renglones existentes con el mismo código de tarjeta o vale
		SELECT @sCo_Tar = co_tar, @sCo_Val = co_vale FROM saMovimientoCaja WHERE mov_num = @sMov_Afec_c

		DECLARE PENDIENTE_ACTUALIZAR CURSOR LOCAL FAST_FORWARD FOR
			SELECT A.mov_afec_c, A.reng_num, A.monto FROM saDepositoBancoReng A 
				INNER JOIN saMovimientoCaja B ON A.mov_afec_c = B.mov_num WHERE A.dep_num = @sDep_Num 
				AND (((@sCo_Tar IS NOT NULL) AND (B.co_tar = @sCo_Tar)) OR ((@sCo_Val IS NOT NULL) AND (B.co_vale = @sCo_Val)))
				
		OPEN PENDIENTE_ACTUALIZAR
		FETCH NEXT FROM PENDIENTE_ACTUALIZAR INTO @sMov_Afec_c_Old, @iReng_Num_Old, @deMonto_Old
		WHILE @@FETCH_STATUS = 0
		BEGIN
			UPDATE saDepositoBancoReng 
			SET comision = ((@deMonto_Old * @deComision)/100), impuesto = dbo.CalcularImpuestoTarjetas(@sMov_Afec_c, @deMonto_Old, @deImpuesto),
				co_sucu_mo = @sCo_Sucu_In, co_us_mo = @sCo_Us_In, fe_us_mo = GETDATE(), porc_comision = @deComision, porc_impuesto = @deImpuesto
			WHERE dep_num = @sDep_Num AND mov_afec_c = @sMov_Afec_c_Old AND reng_num = @iReng_Num_Old
			
			FETCH NEXT FROM PENDIENTE_ACTUALIZAR INTO @sMov_Afec_c_Old, @iReng_Num_Old, @deMonto_Old
```
